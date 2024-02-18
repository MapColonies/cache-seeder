FROM node:20 as build_mapproxy

WORKDIR /usr/src/app
COPY . .

# build and compile all python packages required for mapproxy utility
RUN apt-get update  
RUN apt-get install python3-pip -y
RUN apt install python3.11-venv -y
RUN apt-get install python3-pil -y python3-yaml python3-pyproj
RUN apt-get install libgeos-dev -y python3-lxml libgdal-dev python3-shapely
RUN apt-get install build-essential -y python3-dev libjpeg-dev zlib1g-dev libfreetype6-dev

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip3 install Pillow==7.0.0
RUN pip3 install MapProxy==1.16.0
RUN pip3 install -r docker/requirements.txt
RUN pip3 install requests==2.27.1
RUN pip3 install install uplink
# on future mapproxy >2 will contain the redis.py fixed patch
RUN cp ./docker/patch/redis.py /opt/venv/lib/python3.11/site-packages/mapproxy/cache/redis.py

FROM node:20 as mid

WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm install
COPY . .
RUN npm run build


FROM node:20-slim as production

ENV NODE_ENV=production

# install the application
WORKDIR /usr/src/app
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

RUN apt-get update || : && apt-get install python3 -y
RUN apt install dumb-init
RUN apt-get install -y procps && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=mid /usr/src/app/dist .
COPY --chown=node:node ./config ./config

# set python compiled venv as major
COPY --from=build_mapproxy /opt/venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN mkdir -p /mapproxy && \
    chown node:node /mapproxy
RUN chmod -R 777 /mapproxy


USER node
EXPOSE 8080
CMD ["dumb-init", "node", "--max_old_space_size=512", "./index.js"]

