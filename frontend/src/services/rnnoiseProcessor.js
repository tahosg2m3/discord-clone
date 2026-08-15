import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

export const RNNOISE_SAMPLE_RATE = 48000;

let rnnoiseBinaryPromise = null;

export function isRnnoiseRuntimeSupported() {
  return Boolean(
    typeof window !== 'undefined'
      && typeof window.AudioWorkletNode === 'function'
      && typeof window.WebAssembly === 'object'
      && (window.AudioContext || window.webkitAudioContext),
  );
}

function loadRnnoiseBinary() {
  if (!rnnoiseBinaryPromise) {
    rnnoiseBinaryPromise = loadRnnoise({
      url: rnnoiseWasmUrl,
      simdUrl: rnnoiseSimdWasmUrl,
    }).catch((error) => {
      // Ağ/asset hatası kalıcı olarak cache'lenmesin; sonraki denemede RNNoise
      // yeniden yüklenebilsin.
      rnnoiseBinaryPromise = null;
      throw error;
    });
  }
  return rnnoiseBinaryPromise;
}

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

export async function createRnnoiseProcessor(
  context,
  { onProcessorError, warmupMs = 250 } = {},
) {
  if (!isRnnoiseRuntimeSupported() || !context?.audioWorklet) {
    throw new Error('RNNoise için AudioWorklet/WebAssembly desteği bulunamadı.');
  }
  if (context.sampleRate !== RNNOISE_SAMPLE_RATE) {
    throw new Error(`RNNoise 48 kHz gerektiriyor; ses bağlamı ${context.sampleRate} Hz açıldı.`);
  }

  const [wasmBinary] = await Promise.all([
    loadRnnoiseBinary(),
    context.audioWorklet.addModule(rnnoiseWorkletUrl),
  ]);

  let node;
  let destroyed = false;
  let initialError = null;
  const handleProcessorError = (event) => {
    const error = event?.error instanceof Error
      ? event.error
      : new Error('RNNoise AudioWorklet işlemi durdu.');
    initialError = error;
    if (!destroyed) onProcessorError?.(error);
  };

  try {
    node = new RnnoiseWorkletNode(context, {
      maxChannels: 1,
      wasmBinary,
    });
    node.addEventListener('processorerror', handleProcessorError);

    // Paket WASM durumunu worklet içinde asenkron oluşturuyor ve bir "ready"
    // olayı yayınlamıyor. Bu kısa hazırlık süresince ana ses zinciri hâlâ eski
    // mikrofonu (ilk bağlantıda ise güvenli bypass yolunu) kullanır.
    await wait(warmupMs);
    if (initialError) throw initialError;

    return {
      node,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        node.removeEventListener('processorerror', handleProcessorError);
        try { node.destroy(); } catch { /* Worklet zaten kapanmış olabilir. */ }
        try { node.disconnect(); } catch { /* Bağlı olmayabilir. */ }
        try { node.port.close(); } catch { /* Bazı tarayıcılar port.close sağlamaz. */ }
      },
    };
  } catch (error) {
    if (node) {
      node.removeEventListener('processorerror', handleProcessorError);
      try { node.destroy(); } catch { /* Worklet başlatılamamış olabilir. */ }
      try { node.disconnect(); } catch { /* Bağlı olmayabilir. */ }
      try { node.port.close(); } catch { /* Port başlatılmamış olabilir. */ }
    }
    throw error;
  }
}
