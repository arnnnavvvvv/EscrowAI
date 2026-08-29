# Container image for the sample webhook service — no dependencies, so the build is just a copy.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV PORT=4000
ENV EFFECTS_LOG_PATH=/tmp/sample-target-effects.log
EXPOSE 4000

CMD ["node", "src/server.js"]
