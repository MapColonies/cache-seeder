# Mapproxy Cache Seeder

----------------------------------

![badge-alerts-lgtm](https://img.shields.io/lgtm/alerts/github/MapColonies/cache-seeder?style=for-the-badge)

![grade-badge-lgtm](https://img.shields.io/lgtm/grade/javascript/github/MapColonies/cache-seeder?style=for-the-badge)

![snyk](https://snyk.io/test/github/MapColonies/cache-seeder/badge.svg)

----------------------------------

This worker is responsible for tracking layer's update and seeding\cleaning cache on redis automatically by job-tasks polling

Ingestion has an “Update” mode that updates tiles in storage (FS, S3).
We use redis cache in order to serve tiles faster and reduce the load on our services.

In order to refresh \ clean irrelevant cache data from redis the worker use [seed mechanism - mapproxy-utils cli](https://mapproxy.github.io/mapproxy/seed.html#id9)

The worker polls each time seeding tasks from [job-manager service](https://github.com/MapColonies/job-manager).
Each job (tileSeeding) include single task (tileSeeding) that include array of mapproxy caches (seed | cleanup) to execute:

# Job-Task parameters API's according job manager
<br />

## Seed Task Parameters Structure
| Field | What is it | Mandatory   | Type |
| :---:   | :---: | :---: | :---: |
| jobId | original jobId of ingestion\update job | + | UUID |
| spanId | spanId of ingestion\update job | + | UUID |
| cacheType | which cache type should be executed (current version only redis type) | + | String |
| catalogId | Catalog ID of original layer | + | will be UUID |
| seedTasks | seed option per single cache | + | array of seed objects |

<br />


### seedTasks array's Object Structure
| Field | What is it    | Mandatory   | Type |
| :---:   | :---: | :---: | :---: |
| grid | grid name of layer in mapproxy.yaml | + | string |
| mode | define if it is seed or cleanup | + | enum - seed\clean |
| layerId | layer name in mapproxy.yaml (current version only redis type) | + | String |
| geometry | Coverage area for seeding | + | Geometry (GeoJson) |
| fromZoomLevel | start zoom for seeding ranges | + | Integer |
| toZoomLevel | end zoom for seeding ranges | + | Integer |
| refreshBefore | ttl time - define if the cache is expired | + | Date ('ISO_8601' format: yyyy-MM-dd'T'HH:mm:ss) |
| skipUncached | flag to skip seeding on uncached area and ranges | + | Boolean |

------



## Run Locally
### Prerequisites
1. python >=3.8 
2. install mapproxy (current v.1.16) or follow [here](https://mapproxy.org/docs/latest/install.html)

```bash
pip install MapProxy==1.16.0
```


3. install external redis requirements for python
```bash
pip install redis==5.0.0 python-json-logger==2.0.4 prometheus-client==0.17.0 boto3==1.18.32 botocore==1.21.32 googleapis-common-protos==1.53.0 protobuf==3.20.3 shapely==2.0.2
```
4. Replace redis.py patch for current version (not included on current mapproxy redis module.)
copy content from patch [redis.py](https://github.com/MapColonies/cache-seeder/blob/master/docker/patch/redis.py) and replace in python side-package installation.
```bash
cp redis.py <python or venv location>/site-packages/mapproxy/cache/redis.py
```
<br />

### Package installation
Clone the project

```bash

git clone https://github.com/MapColonies/cache-seeder.git

```

Go to the project directory

```bash

cd cache-seeder

```

Install dependencies

```bash

npm install

```

Start the server

```bash

npm start

```

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```


Note: Configure on configuration file the relevant data.