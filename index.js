const PI_ENV = process.env.NODE_ENV === "pi";

const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const Gpio = PI_ENV ? require("pigpio").Gpio : require("pigpio-mock").Gpio;
var dhtSensor = require("node-dht-sensor");

//OUTPUTS
const SERVO_MIN_DEG = 0;
const SERVO_MAX_DEG = 180;
const SERVO_X_PIN = 12;
const SERVO_Y_PIN = 13;
const LIGHT_PIN = 14;

//INPUTS
const TEMP_SENSOR = 15;

const gpioServoX = new Gpio(SERVO_X_PIN, { mode: Gpio.OUTPUT });
const gpioServoY = new Gpio(SERVO_Y_PIN, { mode: Gpio.OUTPUT });
const gpioLight = new Gpio(LIGHT_PIN, { mode: Gpio.OUTPUT });
//const gpioTempSensor = dht(TEMP_SENSOR, 11);

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
    default:
      return state;
  }
};

const degToServoPulse = deg => {
  let k = clamp(2000, 1000, Math.round(deg / 0.18 + 1000));
  console.log(k, Math.round(deg / 0.18 + 1000), deg);
  return k;
};

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
      //TODO Defined 11 or 22
      if (!err) {
        handleAction({ type: "temperature", value: temperature.toFixed(1) });
        handleAction({ type: "humidity", value: humidity.toFixed(1) });
        console.log(
          "temp: " +
            temperature.toFixed(1) +
            "°C, " +
            "humidity: " +
            humidity.toFixed(1) +
            "%"
        );
      }
    });
  }, 3000);

  sensor.on("result", data => {
    console.log(`temp: ${data.temperature}°c`);
    console.log(`rhum: ${data.humidity}%`);
    handleAction({ type: "temperature", value: data.temperature });
    handleAction({ type: "humidity", value: data.humidity });
  });

  sensor.on("badChecksum", () => {
    console.log("checksum failed");
  });
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

//listenGPIO();
app.use(express.static("public"));
