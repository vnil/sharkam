const express = require("express");
const WebSocket = require("ws");
const http = require("http");

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let state = {
  cameraX: 0,
  cameraY: 0,
  light: false,
  temperature: 0,
  leak: false
};

const SERVO_MIN_DEG = -90;
const SERVO_MAX_DEG = 90;

const clamp = (max, min, value) => {
  return Math.max(min, Math.min(max, value));
};

const reduce = (state, m) => {
  switch (m.type) {
    case "cameraX":
      return {
        ...state,
        cameraX: clamp(SERVO_MAX_DEG, SERVO_MIN_DEG, state.cameraX + m.value)
      };
    case "cameraY":
      return {
        ...state,
        cameraY: clamp(SERVO_MAX_DEG, SERVO_MIN_DEG, state.cameraY + m.value)
      };
    case "light":
      return { ...state, light: !state.light };
    default:
      return state;
  }
};

const handleMessage = m => {
  state = reduce(state, m);
};

wss.on("connection", ws => {
  ws.on("message", message => {
    handleMessage(JSON.parse(message));
    wss.clients.forEach(client => {
      client.send(JSON.stringify(state));
    });
  });

  ws.send(JSON.stringify(state));
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});

app.use(express.static("public"));
