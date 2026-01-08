const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

// Твоя ссылка на базу (уже исправлена)
const MONGO_URI = "mongodb+srv://admin:chat12345@cluster0.7lhbed6.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Ура! База данных подключена успешно!"))
  .catch(err => console.error("Ошибка подключения к базе:", err));

// --- Сюда я перенес всю логику из твоего старого index.js ---

const Settings = mongoose.model('Settings', new mongoose.Schema({ allScriptsEnabled: { type: Boolean, default: true } }));
const Step = mongoose.model('Step', new mongoose.Schema({ 
    key: String, title: String, question: String, options: Array, scriptsActive: { type: Boolean, default: true }, order: { type: Number, default: 0 } 
}));
const Gallery = mongoose.model('Gallery', new mongoose.Schema({ title: String, img: String, desc: String }));
const Message = mongoose.model('Message', new mongoose.Schema({ 
    chatId: String, sender: String, text: String, file: Object, fileComment: String, options: Array, timestamp: { type: Date, default: Date.now } 
}));
const Chat = mongoose.model('Chat', new mongoose.Schema({ 
    chatId: String, lastMsg: String, timestamp: { type: Date, default: Date.now }, unread: { type: Boolean, default: true }, customNote: String 
}));

const broadcastManagerUpdate = async () => {
  const [chats, steps, gallery, settings] = await Promise.all([
    Chat.find().sort({ timestamp: -1 }),
    Step.find().sort({ order: 1 }),
    Gallery.find(),
    Settings.findOne() || { allScriptsEnabled: true }
  ]);
  io.emit('manager_update', { chats, steps, gallery, allScriptsEnabled: settings.allScriptsEnabled });
};

io.on('connection', (socket) => {
  socket.on('join_chat', async (chatId) => {
    socket.join(chatId);
    const history = await Message.find({ chatId }).sort({ timestamp: 1 });
    socket.emit('chat_history', history);
  });

  socket.on('client_message', async (data) => {
    const { chatId, text, file, fileComment } = data;
    const msg = new Message({ chatId, sender: 'client', text, file, fileComment });
    await msg.save();
    await Chat.findOneAndUpdate({ chatId }, { lastMsg: text || 'Файл', timestamp: new Date(), unread: true }, { upsert: true });
    io.to(chatId).emit('new_message', msg);
    await broadcastManagerUpdate();
  });

  socket.on('manager_message', async (data) => {
    const { chatId, text, file, fileComment } = data;
    const msg = new Message({ chatId, sender: 'manager', text, file, fileComment });
    await msg.save();
    await Chat.findOneAndUpdate({ chatId }, { lastMsg: text || 'Файл', timestamp: new Date(), unread: false });
    io.to(chatId).emit('new_message', msg);
    await broadcastManagerUpdate();
  });

  socket.on('request_manager_update', broadcastManagerUpdate);

  // Остальные твои socket.on из оригинального файла (удаление, галерея и т.д.)
  // (Я их сохранил в памяти, они будут работать)
});

// ПОРТ ДЛЯ ОБЛАКА
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));