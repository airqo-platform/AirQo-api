const { Worker } = require("worker_threads");
const path = require("path");
const os = require("os");
const ora = require("ora");
const axios = require("axios");

// this is how we can get the count of cpu's the computer has,
// using a larger number may result in the app crushing
const cpuCount = os.cpus().length;
const WORKER_COUNT = 2;
// create some big array
// const elements = 5000000;
// console.log(`generating ${elements} random numbers...\n`);
// const dataArray = Array(elements)
//   .fill()
//   .map(() => Math.random());

// we get the path of the script
const workerScript = path.join(__dirname, "/airqo-insert-one.js");

// we turn the worker activation into a promise
const processArrayWithWorker = (arr) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript, { workerData: arr });
    worker.on("message", resolve);
    worker.on("error", reject);
  });
};

// this function will distribute the array across workers
async function distributeLoadAcrossWorkers(workers, dataArray) {
  // how many elements each worker should process
  const segmentsPerWorker = Math.round(dataArray.length / workers);
  const promises = Array(workers)
    .fill()
    .map((_, index) => {
      let arrayToProcess;
      if (index === 0) {
        // the first segment
        arrayToProcess = dataArray.slice(0, segmentsPerWorker);
      } else if (index === workers - 1) {
        // the last segment
        arrayToProcess = dataArray.slice(segmentsPerWorker * index);
      } else {
        // intermediate segments
        arrayToProcess = dataArray.slice(
          segmentsPerWorker * index,
          segmentsPerWorker * (index + 1)
        );
      }
      return processArrayWithWorker(arrayToProcess);
    });
  // merge all the segments of the array
  const segmentsResults = await Promise.all(promises);
  return segmentsResults.reduce((acc, arr) => acc.concat(arr), []);
}

// this is the main function (it's only to allow the use of async await for simplicity)
async function run() {
  // get the channels on the platform
  const getChannels = async () => {
    try {
      const channelsAPI = `https://api.thingspeak.com/channels.json?api_key=JQZOU97VDLX7OTDH`;
      console.log("channelsAPI", channelsAPI);
      const response = await axios.get(channelsAPI);
      return response.data;
    } catch (e) {
      console.log(e.message);
    }
  };
  const dataArray = await getChannels();
  const spinner = ora("Starting the main function....\n").start();
  spinner.color = "yellow";
  spinner.text = "Processing... this may take a while....\n";

  // process with a selected number of workers
  const start1 = Date.now();
  const result1 = await distributeLoadAcrossWorkers(WORKER_COUNT, dataArray);
  console.log(
    `Processed ${result1.length} items, with 
    ${WORKER_COUNT} worker(s) in ${Date.now() - start1}ms\n`
  );

  // process with no worker at all
  // let start2 = Date.now();
  // const result2 = dataArray.process((a, b) => a - b);
  // console.log(
  //   `processed ${result2.length} items, without workers in ${
  //     Date.now() - start2
  //   }ms`
  // );

  // // process with multiple workers, based on the cpu count
  // const start3 = Date.now();
  // const result3 = await distributeLoadAcrossWorkers(cpuCount, dataArray);
  // console.log(
  //   `processed ${result3.length} items, with ${cpuCount} workers in ${
  //     Date.now() - start3
  //   }ms`
  // );

  spinner.stop();
  console.log("\n done");
}

run();
