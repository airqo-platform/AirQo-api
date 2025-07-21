const data = {
  last_updated_timestamp: "2024-01-08T13:45:39.155229",
  regions: [
    {
      region: "sa-bogota-1",
      cidrs: [
        {
          cidr: "149.130.160.0/19",
          tags: ["OCI"],
        },
        {
          cidr: "158.247.120.0/21",
          tags: ["OCI"],
        },
      ],
    },
    {
      region: "sa-valparaiso-1",
      cidrs: [
        {
          cidr: "149.130.224.0/19",
          tags: ["OCI"],
        },
        {
          cidr: "165.1.120.0/21",
          tags: ["OCI"],
        },
      ],
    },
    {
      region: "ca-montreal-1",
      cidrs: [
        {
          cidr: "68.233.120.0/21",
          tags: ["OCI"],
        },
        {
          cidr: "192.29.92.0/22",
          tags: ["OSN"],
        },
      ],
    },
  ],
};

const fs = require("fs");

function extractCidrsAndSave(data) {
  let result = [];

  for (let region of data.regions) {
    for (let cidr of region.cidrs) {
      result.push(cidr.cidr);
    }
  }

  ipArray = result.map((ip) => `"${ip}",`);

  // Join the array of strings into a single string separated by commas
  let formattedIPAddresses = ipArray.join("\n");

  // Generate the filename
  const date = new Date();
  const fileName = `array-${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}.txt`;

  // Write the result array to the file
  fs.writeFile(fileName, formattedIPAddresses, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Data saved to ${fileName}`);
    }
  });
}

extractCidrsAndSave(data);
