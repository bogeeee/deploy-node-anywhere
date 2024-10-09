# instead of `FROM node:latest`, we use a fixed version, were we definitely know, that it works.
FROM node@sha256:b632a1ec41a0927d19a432c525641b9a4451251d0b0b63f1d764810a562ea4e1

ENV NODE_ENV production
RUN apt update
RUN apt -y install rsync
RUN mkdir autopuller

CMD /bin/bash