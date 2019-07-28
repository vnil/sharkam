const PI_ENV = process.env.NODE_ENV === "pi";

const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const Gpio = PI_ENV ? require("pigpio").Gpio : require("pigpio-mock").Gpio;
var dhtSensor = require("node-dht-sensor");

const SERVO_MIN_DEG = 0;
const SERVO_MAX_DEG = 180;

//OUTPUTS
const SERVO_X_PIN = 20;
const SERVO_Y_PIN = 21;
const LIGHT_PIN = 12;

//INPUTS
const TEMP_SENSOR = 16;

const gpioServoX = new Gpio(SERVO_X_PIN, { mode: Gpio.OUTPUT });
const gpioServoY = new Gpio(SERVO_Y_PIN, { mode: Gpio.OUTPUT });
const gpioLight = new Gpio(LIGHT_PIN, { mode: Gpio.OUTPUT });

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let state = {
  cameraX: 90,
  cameraY: 90,
  light: false,
  temperature: 0,
  humidity: 0,
  leak: false
};

const clamp = (max, min, value) => {
  return Math.max(min, Math.min(max, value));
};

const reduce = (state, action) => {
  switch (action.type) {
    case "cameraX":
      return {
        ...state,
        cameraX: clamp(
          SERVO_MAX_DEG,
          SERVO_MIN_DEG,
          state.cameraX + action.value
        )
      };
    case "cameraY":
      return {
        ...state,
        cameraY: clamp(
          SERVO_MAX_DEG,
          SERVO_MIN_DEG,
          state.cameraY + action.value
        )
      };
    case "light":
      return { ...state, light: !state.light };
    case "temperature":
      return { ...state, temperature: action.value };
    case "humidity":
      return { ...state, humidity: action.value };
    default:
      return state;
  }
};

const degToServoPulse = deg => clamp(2000, 1000, Math.round(deg / 0.18 + 1000));

const updateGPIO = () => {
  gpioServoX.servoWrite(degToServoPulse(state.cameraX));
  gpioServoY.servoWrite(degToServoPulse(state.cameraY));
  gpioLight.digitalWrite(state.light);
};

const listenGPIO = () => {
  if (!PI_ENV) {
    console.log("NOT PI ENVIRONEMTN - SKIPPING GPIO INPUTS");
    return;
  }

  setInterval(() => {
    dhtSensor.read(11, TEMP_SENSOR, function(err, temperature, humidity) {
      if (!err) {
        handleAction({
          type: "temperature",
          value: Math.round(temperature)
        });
        handleAction({ type: "humidity", value: Math.round(humidity) });
      }
    });
  }, 3000);
};

const handleAction = action => {
  state = reduce(state, action);
  updateGPIO();
  wss.clients.forEach(client => {
    client.send(JSON.stringify(state));
  });
};

wss.on("connection", ws => {
  ws.on("message", message => {
    handleAction(JSON.parse(message));
  });

  ws.send(JSON.stringify(state));
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});

listenGPIO();
app.use(express.static("public"));
