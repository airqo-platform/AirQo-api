const axios = require("axios");
const isEmpty = require("is-empty");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

function separateItemsByUserId(items) {
  const tokenMap = new Map();
  const duplicateItems = [];
  const uniqueItems = [];

  for (const item of items) {
    if (tokenMap.has(item.user_id)) {
      duplicateItems.push(item);
    } else {
      tokenMap.set(item.user_id, true);
      uniqueItems.push(item);
    }
  }

  return { duplicateItems, uniqueItems };
}

function findDuplicateObjects(arr) {
  const emailCounts = {}; // Object to store email counts
  const duplicateIds = []; // Array to store duplicate _id values

  // Iterate over the array of objects
  for (const obj of arr) {
    const { _id, email } = obj;

    // Count the number of occurrences of each email
    if (emailCounts[email]) {
      emailCounts[email]++;
    } else {
      emailCounts[email] = 1;
    }

    // Add duplicate _id values to the array
    if (emailCounts[email] > 1) {
      duplicateIds.push(_id);
    }
  }

  const result = []; // Final array without objects having similar email addresses

  // Filter out objects with duplicate emails
  for (const obj of arr) {
    const { _id, email } = obj;

    // Add objects to the result array only if their email count is 1
    if (emailCounts[email] === 1) {
      result.push(obj);
    }
  }

  return { duplicateIds, result, emailCounts };
}

// Make a GET request
const url = "http://localhost:3000/api/v2/users";
const config = {
  headers: {
    Authorization: "",
  },
};
axios
  .get(url, config)
  .then((response) => {
    const users = response.data.users;
    for (let i = 0; i < users.length; i += 10) {
      const batch = users.slice(i, i + 10);
      // Process batch of 10 items
      batch.forEach(async (user) => {
        if (user.lol && user.lol._id && user.lol.network_id) {
          let update = {
            network_roles: [
              {
                network: user.lol.network_id,
                role: user.lol._id,
              },
            ],
          };
          const url = `http://localhost:3000/api/v2/users/${user._id}`;
          // Make a PUT request
          axios
            .put(url, update, config)
            .then((response) => {
              console.log("PUT response:", response.data);
            })
            .catch((error) => {
              if (error.response) {
                console.log(error.response.status);
                console.log(error.response.data);
              } else {
                console.log(error.message);
              }
            });
        } else {
          console.log(
            `the user ${user._id} has NO role ${user.lol}  at the moment`
          );
        }
      });
    }
  })
  .catch((error) => {
    console.error("GET error:", error);
  });
