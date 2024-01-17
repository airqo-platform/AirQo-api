const routesWithService = [
  /* Your routesWithService array */
];
const routeDefinitions = [
  /* Your routeDefinitions array */
];

// Create a map for faster lookup
const routesMap = new Map(
  routesWithService.map((route) => [route.service, route])
);

// Iterate over routeDefinitions
for (const definition of routeDefinitions) {
  // If the service does not exist in routesWithService
  if (!routesMap.has(definition.service)) {
    // Add the entire object from routeDefinitions to routesWithService
    routesWithService.push(definition);
    // And also add it to the map
    routesMap.set(definition.service, definition);
  }
}

console.log(routesWithService);
