/* eslint-disable */
require("dotenv").config();

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const firestoreDb = getFirestore();

module.exports = { firestoreDb };
