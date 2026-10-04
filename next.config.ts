import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos se suben una por una (comprimidas en el teléfono, < 1 MB cada una).
      // El envío final lleva solo datos y las dos firmas en PNG.
      // Se mantiene por debajo del límite de 4.5 MB por petición de Netlify.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
