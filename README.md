# Discord Clone - Full Stack Chat Application

## Features

✅ Real-time messaging (Socket.io)
✅ Voice channels with WebRTC
✅ Screen sharing
✅ GIF support (Tenor API)
✅ User authentication (JWT)
✅ Multiple servers & channels
✅ Desktop app (Electron - Windows/Mac/Linux)
✅ Web app
✅ Typing indicators
✅ Online user list

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Socket.io-client, PeerJS
**Backend:** Node.js, Express, Socket.io, JWT, bcrypt
**Desktop:** Electron
**Database:** In-memory (MongoDB ready)

---

## 🚀 Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/tahosg2m3/discord-clone.git
cd discord-clone
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables

**backend/.env**
```
PORT=3001
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development
```

### 4. Run Development Servers

**Option A: All at once**
```bash
npm run dev
```

**Option B: Separate terminals**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Electron (after frontend starts)
npm run dev:electron
```

### 5. Access Application

- **Web:** http://localhost:5173
- **Desktop:** Electron window will open automatically

---

## 📦 Build for Production

### Web App
```bash
cd frontend
npm run build
```

### Desktop App

**Windows:**
```bash
npm run build
# Output: release/Discord Clone Setup.exe
```

**macOS:**
```bash
npm run build
# Output: release/Discord Clone.dmg
```

**Linux:**
```bash
npm run build
# Output: release/Discord Clone.AppImage
```

---

## 🎮 Usage

### 1. Register Account
- Open app
- Click "Sign Up"
- Enter username, email, password
- Click "Create Account"

### 2. Join Server
- Default server appears on left
- Click server icon
- Select a channel

### 3. Text Chat
- Type message in input box
- Press Enter to send
- Click GIF button to send GIFs

### 4. Voice Chat
- Click a voice channel
- Click microphone button to join
- Controls: Mute, Deafen, Screen Share, Leave

### 5. Create Server
- Click "+" button on left sidebar
- Enter server name
- New server appears

---

## 🔧 Configuration

### Backend Port
Change in `backend/.env`:
```
PORT=3001
```

### Frontend Port
Change in `frontend/vite.config.js`:
```javascript
export default defineConfig({
  server: {
    port: 5173,
  },
})
```

### PeerJS Server
For voice/video, run PeerJS server:
```bash
npm install -g peer
peerjs --port 9000
```

Or use public PeerJS cloud server in `VoiceContext.jsx`:
```javascript
const newPeer = new Peer(user.id, {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
});
```

---

## 🐛 Troubleshooting

### "Cannot find module 'bcrypt'"
```bash
cd backend
npm install bcrypt jsonwebtoken
```

### Voice not working
1. Check PeerJS server is running
2. Check microphone permissions
3. Check browser console for errors

### Electron app not starting
```bash
npm install electron electron-builder --save-dev
```

### Port already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

---

## 📱 Platform Support

| Platform | Status | Format |
|----------|--------|--------|
| Windows | ✅ | .exe installer |
| macOS | ✅ | .dmg |
| Linux | ✅ | .AppImage, .deb |
| Web | ✅ | Browser |

---

## 🔐 Security Notes

⚠️ **IMPORTANT:** This is a development setup. For production:

1. Change `JWT_SECRET` in `.env`
2. Use HTTPS
3. Add rate limiting
4. Use proper database (MongoDB)
5. Validate all inputs
6. Use environment variables
7. Enable CORS only for your domain
8. Hash passwords properly (already done with bcrypt)

---

## 📄 License

MIT License - Feel free to use for learning and personal projects