# Menggunakan image Node.js resmi versi terbaru sebagai base image
FROM node:18

# Atur direktori kerja di dalam container
WORKDIR /usr/src/app

# Salin package.json dan package-lock.json ke container
COPY package*.json ./

# Install dependencies aplikasi
RUN npm install

# Salin semua file dari direktori lokal ke dalam direktori kerja di container
COPY . .

# Expose port yang digunakan oleh aplikasi
EXPOSE 3000

# Jalankan aplikasi ketika container di-start
CMD ["node", "index.js"]
