import { NRRDLoader } from "three/addons/loaders/NRRDLoader.js";

const loader = new NRRDLoader();

export async function loadNRRD(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}
