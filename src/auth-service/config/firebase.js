const { initializeApp } = require("firebase/app");

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  messagingSenderId: "",
  appId: "",
};

const app = initializeApp(firebaseConfig);
module.exports = app;
