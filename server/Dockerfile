From zhangtr/ubuntu_base:latest

MAINTAINER ztr_999@126.com

RUN mkdir -p /usr/src/mediasoup_server
WORKDIR /usr/src/mediasoup_server

COPY . /usr/src/mediasoup_server
RUN cp /usr/src/mediasoup_server/config.example.js /usr/src/mediasoup_server/config/config.js


RUN strings /usr/lib/x86_64-linux-gnu/libstdc++.so.6 | grep GLIBCXX

RUN npm install
#RUN npm update mediasoup_nodemodule
#RUN npm cache clean --force

EXPOSE 4443

CMD ["npm" , "start"]