# Device Registry

This microservice handles the device creation, site creation, events creation and the respective 
activities whch take place on a site. 

## Run Locally

#### a) Using npm scripts


Clone the project

```bash
  git clone https://github.com/airqo-platform/AirQo-api
```

Go to the microservice directory
```bash 
  cd AirQo-api/src/device-registry
```
Install the dependencies
```bash
  npm install 
```
To run on MacOS
```bash
  npm run dev-mac
```
To run on Windows
```bash
  npm run dev-pc
```

#### b) Using Docker

Build the image within the microservice's directory
```bash
docker build -t {IMAGE_NAME} .
```
Then run the container based on the newly created image

```bash
docker run -d -n {CONTAINER_NAME} -p host-port:container-port {IMAGE_NAME}
```

After successfully runing the container, you can go ahead and test out the respective endpoints

## Deployment

To deploy this project, we take advantages of kubernetes
 as a container orchestration tool


  Build the image within the microservice's directory
```bash
docker build -t {IMAGE_NAME} .
```

Push the respective images to a respective Docker register

Use the images in deployment files for Kubernetes accordingly

## API Reference

#### Get all devices

```http
  GET /api/v1/devices
```

| Query Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `tenant` | `string` | **Required**. the tenant string |
| `active` | `string` | **Optional**. filters active device, _yes_ returns active devices, _no_ returns inactive devices |
| `primary` | `string` | **Optional**.  yes returns primary in location devices, no returns non primary devices |
| `site` | `string` | **Optional**. the name of the site which appears on upper section of the Map nodes |
| `map` | `string` | **Optional**. the map address which appears on the lower section of the map nodes |
| `channel` | `string` | **Optional**. the unique channel ID |
| `chid` | `string` | **Optional**. the unique channel ID |
| `name` | `string` | **Optional**. the name of the device |
| `skip` | `Number` | **Optional**. skip this number of records in the response |
| `limit` | `Number` | **Optional**. limit the response to this number of records |
| `location` | `string` | **Optional**. the unique location ID |
| `site_id` | `string` | **Optional**. the site_id associated with the device |
| `siteName` | `string` | **Optional**. the siteName associated with the device |
| `mapAddress` | `string` | **Optional**. the mapAddress associated with the device |
| `map` | `string` | **Optional**. the mapAddress associated with the device |
| `primary` | `string` | **Optional**. yes if device is primary and no if it is not |
| `active` | `string` | **Optional**. yes if device is active and no if it is not active|


#### Get all sites

```http
  GET /api/v1/devices/sites
```

| Query Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `tenant`      | `string` | **Required**. the tenant/organisation |
| `id`      | `Object ID` | **Optional**. the Object ID of the site |
| `lat_long`      | `string` | **Optional**. the lat_long string of the site |
| `generated_name`      | `Number` | **Optional**. the generated name of the site |
| `formatted_name`      | `Number` | **Optional**. the formatted name of the site |
| `name`      | `string` | **Optional**. the name of the site |
| `county`      | `string` | **Optional**. the county of the site |
| `district`      | `string` | **Optional**. the district of the site |
| `region`      | `string` | **Optional**. the region of the site |
| `city`      | `string` | **Optional**. the city of the site |
| `street`      | `string` | **Optional**. the street of the site |
| `country`      | `string` | **Optional**. the country of the site |
| `parish`      | `string` | **Optional**. the parish of the site |


#### Get all Events

```http
  GET /api/v1/devices/events
```

| Query Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `tenant`      | `string` | **Required**. the tenant/organisation |
| `startTime`      | `string` | **Optional**. the startTime which can be datetime (YYYY-MM-DDTHH:MM:SS.MSSZ) or just a day (YYYY-MM-DD) |
| `endTime`      | `string` | **Optional**. the endTime which can be datetime (YYYY-MM-DDTHH:MM:SS.MSSZ) or just a day (YYYY-MM-DD) |
| `device`      | `Number` | **Optional**. the unique name of the device |
| `frequency`      | `Number` | **Optional**. the formatted name of the site |


#### Get all Site activities

```http
  GET /api/v1/devices/activities
```

| Query Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `tenant`      | `string` | **Required**. the tenant/organisation |
| `site_id`      | `string` | **Optional**. the id of the site |
| `activity_tags`      | `string` | **Optional**. the tags for the activity |
| `maintenance_type`      | `string` | **Optional**. the type of maintenance |
| `id`      | `Object ID` | **Optional**. the Object ID associated with the activity |
| `device`      | `string` | **Optional**. the unique device name |
