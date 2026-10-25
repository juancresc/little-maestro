# The video job: headless Chrome (from Playwright) + ffmpeg. Runs once per command, then exits.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /job
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY export.mjs ./
ENTRYPOINT ["node", "export.mjs"]
