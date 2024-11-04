import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { loadNRRD } from "./nrrd";
import {
  intersectionsTo2DSpace,
  convert2DSpaceVectorsBackTo3D,
} from "./helpers";
import { Vector3 } from "three";
import Flatten from "@flatten-js/core";

const volume = await loadNRRD("./I.nrrd");

console.log(volume);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.localClippingEnabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

camera.position.z = 5;

const controls = new TrackballControls(camera, renderer.domElement);
controls.minDistance = 300;
controls.maxDistance = 400;
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 5;
controls.panSpeed = 2;

const SQRT1_3 = Math.sqrt(1 / 3);

// 6-intersection cut

const plane = new THREE.Plane(new THREE.Vector3(SQRT1_3, SQRT1_3, SQRT1_3), 0);

// 4-intersection cut
// const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

const gui = new GUI();
gui.add(plane.normal, "x", -1, 1);
gui.add(plane.normal, "y", -1, 1);
gui.add(plane.normal, "z", -1, 1);

let cube = null;

const canvas = document.createElement("canvas");

// load a4c.jpeg and draw to canvas
const ctx = canvas.getContext("2d");
// const img = new Image();
// img.onload = function () {
//   canvas.width = img.width;
//   canvas.height = img.height;
//   ctx.drawImage(img, 0, 0);
// };
// img.src = "https://i.imgur.com/7Fqs2mU.png";

// draw the canvas as blue
ctx.fillStyle = "blue";
ctx.fillRect(0, 0, canvas.width, canvas.height);

document.body.appendChild(canvas);

const meshesToRemove = [];

function createSimpleBox() {
  const geometry = new THREE.BoxGeometry(
    volume.RASDimensions[0],
    volume.RASDimensions[1],
    volume.RASDimensions[2]
  );
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

  material.clippingPlanes = [plane];
  cube = new THREE.Mesh(geometry, material);
  cube.visible = true;
  const box = new THREE.BoxHelper(cube);
  scene.add(box);
  scene.add(cube);

  meshesToRemove.push(cube);
  meshesToRemove.push(box);
}

let planeMesh = null;
let intersectionsFaceMesh = null;

function getVertices(mesh) {
  const position = mesh.geometry.getAttribute("position");
  const vertices = [];

  for (let i = 0; i < position.count / position.itemSize; i++) {
    const vertex = new THREE.Vector3(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    );

    vertices.push(vertex);
  }

  return vertices;
}

function drawPlane() {
  meshesToRemove.forEach((mesh) => scene.remove(mesh));

  createSimpleBox();

  // Also draw a simple axial slice
  // const axialSlice1 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.RASDimensions[2] / 4)
  // );

  // const axialSlice2 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.RASDimensions[2] / 2)
  // );

  // const axialSlice3 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.RASDimensions[2] / 1)
  // );
  // scene.add(axialSlice1.mesh);
  // scene.add(axialSlice2.mesh);
  // scene.add(axialSlice3.mesh);

  // meshesToRemove.push(axialSlice1.mesh);
  // meshesToRemove.push(axialSlice2.mesh);
  // meshesToRemove.push(axialSlice3.mesh);

  const planeGeometry = new THREE.PlaneGeometry(1000, 10000);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  });
  planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  planeMesh.lookAt(plane.normal);
  // scene.add(planeMesh);

  const cubeVertices = getVertices(cube);

  // Build the edges from the vertices
  const edges = [
    [cubeVertices[0], cubeVertices[1]],
    [cubeVertices[1], cubeVertices[3]],
    [cubeVertices[2], cubeVertices[3]],
    [cubeVertices[3], cubeVertices[6]],
    [cubeVertices[4], cubeVertices[5]],
    [cubeVertices[5], cubeVertices[7]],
    [cubeVertices[6], cubeVertices[7]],
    [cubeVertices[7], cubeVertices[5]],
    [cubeVertices[0], cubeVertices[2]],
    [cubeVertices[0], cubeVertices[5]],
    [cubeVertices[2], cubeVertices[7]],
    [cubeVertices[1], cubeVertices[4]],
    [cubeVertices[4], cubeVertices[6]],
  ].map((edges) => new THREE.Line3(...edges));

  const origin = new THREE.Vector3(0, 0, 0);

  let intersectionPoints = edges
    .map((edge) => {
      const intersection = new THREE.Vector3();
      plane.intersectLine(edge, intersection);
      return intersection;
    })
    .filter((i) => !i.equals(origin));

  // Remove duplicates
  const uniquePoints = [];
  intersectionPoints.forEach((point) => {
    if (!uniquePoints.some((p) => p.equals(point))) {
      uniquePoints.push(point);
    }
  });

  // Order points by angle centered around (0, 0, 0)
  intersectionPoints = uniquePoints.sort((a, b) => {
    const angleA = Math.atan2(a.y, a.x);
    const angleB = Math.atan2(b.y, b.x);

    return angleA - angleB;
  });

  for (let i = 0; i < intersectionPoints.length; i++) {
    const point = intersectionPoints[i];
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([point.x, point.y, point.z]),
        3
      )
    );
    const dotMaterial = new THREE.PointsMaterial({
      size: 25,
      color: 0xff0000,
    });
    const dot = new THREE.Points(dotGeometry, dotMaterial);
    scene.add(dot);
    meshesToRemove.push(dot);
  }

  // Draw a polygon connecting all the points

  const faceGeometry = new THREE.BufferGeometry();
  const faceVertices = new Float32Array(intersectionPoints.length * 9);

  for (let i = 0; i < intersectionPoints.length; i++) {
    const offset = i * 9;

    faceVertices[offset] = intersectionPoints[i].x;
    faceVertices[offset + 1] = intersectionPoints[i].y;
    faceVertices[offset + 2] = intersectionPoints[i].z;

    faceVertices[offset + 3] =
      intersectionPoints[(i + 1) % intersectionPoints.length].x;
    faceVertices[offset + 4] =
      intersectionPoints[(i + 1) % intersectionPoints.length].y;
    faceVertices[offset + 5] =
      intersectionPoints[(i + 1) % intersectionPoints.length].z;

    faceVertices[offset + 6] = 0;
    faceVertices[offset + 7] = 0;
    faceVertices[offset + 8] = 0;
  }

  faceGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(faceVertices, 3)
  );

  const canvasMap = new THREE.CanvasTexture(canvas);
  // canvasMap.minFilter = THREE.LinearFilter;
  // canvasMap.generateMipmaps = true;
  // canvasMap.wrapS = canvasMap.wrapT = THREE.ClampToEdgeWrapping;
  // canvasMap.colorSpace = THREE.SRGBColorSpace;

  const faceMaterial = new THREE.MeshBasicMaterial({
    map: canvasMap,
    side: THREE.DoubleSide,
  });

  // intersectionsFaceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
  // scene.add(intersectionsFaceMesh);

  // Try a different approach - add a PlaneGeometry and clip it against the edges of the boudning box
  const planeGeometry2 = new THREE.PlaneGeometry(1000, 1000);
  const planeMaterial2 = new THREE.MeshBasicMaterial({
    map: canvasMap,
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  const box3 = new THREE.Box3();
  box3.setFromObject(cube);

  const min = box3.min;
  const max = box3.max;

  const forward = new THREE.Vector3(0, 0, 1);
  const backward = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3(1, 0, 0);
  const left = new THREE.Vector3(-1, 0, 0);
  const upward = new THREE.Vector3(0, 1, 0);
  const downward = new THREE.Vector3(0, -1, 0);

  // Box faces as planes
  const frontPlane = new THREE.Plane();
  frontPlane.setFromNormalAndCoplanarPoint(forward, min);

  const leftPlane = new THREE.Plane();
  leftPlane.setFromNormalAndCoplanarPoint(right, min);

  const rightPlane = new THREE.Plane();
  rightPlane.setFromNormalAndCoplanarPoint(left, max);

  const backPlane = new THREE.Plane();
  backPlane.setFromNormalAndCoplanarPoint(backward, max);

  const topPlane = new THREE.Plane();
  topPlane.setFromNormalAndCoplanarPoint(downward, max);

  const bottomPlane = new THREE.Plane();
  bottomPlane.setFromNormalAndCoplanarPoint(upward, min);

  const clippingPlanes = [
    frontPlane,
    leftPlane,
    rightPlane,
    backPlane,
    topPlane,
    bottomPlane,
  ];

  planeMaterial2.clippingPlanes = clippingPlanes;
  planeMaterial2.clipIntersection = false;

  intersectionsFaceMesh = new THREE.Mesh(planeGeometry2, planeMaterial2);
  intersectionsFaceMesh.lookAt(plane.normal);
  //scene.add(intersectionsFaceMesh);

  meshesToRemove.push(intersectionsFaceMesh);
  meshesToRemove.push(planeMesh);

  // 1. Project intersection points into 2D space
  const intersectionsIn2D = intersectionsTo2DSpace(
    plane.normal,
    intersectionPoints
  );

  // 2. Find the bounding box of all the intersection points in 2D
  const xValues = intersectionsIn2D.map((point) => point.x);
  const yValues = intersectionsIn2D.map((point) => point.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const boundingRectVectors = [
    new THREE.Vector2(minX, minY),
    new THREE.Vector2(minX, maxY),
    new THREE.Vector2(maxX, maxY),
    new THREE.Vector2(maxX, minY),
  ];

  // 3. Re-project the bounding box back into 3D space
  const intersectionBoundingRectIn3D = convert2DSpaceVectorsBackTo3D(
    plane.normal,
    intersectionPoints,
    boundingRectVectors
  );

  // 4. Draw the mesh of the bounding box
  const boundingRectGeometry = new THREE.BufferGeometry();
  const boundingRectVertices = new Float32Array(12);

  for (let i = 0; i < intersectionBoundingRectIn3D.length; i++) {
    const offset = i * 3;

    boundingRectVertices[offset] = intersectionBoundingRectIn3D[i].x;
    boundingRectVertices[offset + 1] = intersectionBoundingRectIn3D[i].y;
    boundingRectVertices[offset + 2] = intersectionBoundingRectIn3D[i].z;
  }

  boundingRectGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(boundingRectVertices, 3)
  );

  const boundingRectMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const boundingRectMesh = new THREE.LineLoop(
    boundingRectGeometry,
    boundingRectMaterial
  );
  scene.add(boundingRectMesh);
  meshesToRemove.push(boundingRectMesh);

  // 5. Now find the length of the bounding box in the x-axis and y-axis in mm.
  //    This will become the width and height of the canvas & the PlaneGeometry
  //    that we will paint the current slice on.

  const xLength = maxX - minX;
  const yLength = maxY - minY;

  // 6. Calculate the spacing in the projected X & Y dimensions
  const xUnitVector = new Vector3(1, 0, 0);
  const yUnitVector = new Vector3(0, 1, 0);
  const zUnitVector = new Vector3(0, 0, 1);

  const unitVectors = [xUnitVector, yUnitVector, zUnitVector];

  function calculateSpacing(v, spacing) {
    const components = [0, 1, 2].map((idx) => unitVectors[idx].dot(v));
    const spacings = [0, 1, 2].map((idx) => components[idx] * spacing[idx]);
    return Math.abs(spacings.reduce((a, b) => a + b, 0));
  }

  // The x-axis was projected on the first to second intersection
  const xAxisUnitVector = intersectionPoints[1]
    .clone()
    .sub(intersectionPoints[0])
    .normalize();

  // The y-axis was the cross product of the normal and x-axis
  const yAxisUnitVector = plane.normal
    .clone()
    .cross(xAxisUnitVector)
    .normalize();

  const xAxisSpacing = calculateSpacing(xAxisUnitVector, volume.spacing);
  const yAxisSpacing = calculateSpacing(yAxisUnitVector, volume.spacing);

  // 7. Convert this length from mm in realspace to pixels based on the spacing
  //    in the plane's X & Y dims

  const DOWNSCALE_FACTOR = 10;

  const xLengthInPixels = Math.ceil(xLength / xAxisSpacing / DOWNSCALE_FACTOR); // test downscale by factor of 50
  const yLengthInPixels = Math.ceil(yLength / yAxisSpacing / DOWNSCALE_FACTOR);

  // 8. Create a new canvas with the dimensions calculated
  const canvas2 = document.createElement("canvas");
  canvas2.width = xLengthInPixels;
  canvas2.height = yLengthInPixels;
  const ctx2 = canvas2.getContext("2d");

  // 9. Fill the canvas buffer
  const imageData = ctx2.createImageData(xLengthInPixels, yLengthInPixels);
  const data = imageData.data;

  document.body.appendChild(canvas2);

  const pointsPolygon = new Flatten.Polygon(
    intersectionsIn2D.map((point) => new Flatten.Point(point.x, point.y))
  );

  console.log(xLengthInPixels, yLengthInPixels);

  let outsideCnt = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Check if this point in 2D is inside the intersectionsIn2D
    const x =
      ((i / 4) % xLengthInPixels) * DOWNSCALE_FACTOR * xAxisSpacing + minX;
    const y =
      Math.floor(i / 4 / xLengthInPixels) * DOWNSCALE_FACTOR * yAxisSpacing +
      minY;

    // Check if this point is inside the polygon
    const isInside = pointsPolygon.contains(new Flatten.Point(x, y));

    if (isInside) {
      // 10. Convert the point from 2D space back to 3D space
      const pointIn3D = convert2DSpaceVectorsBackTo3D(
        plane.normal,
        intersectionPoints,
        [new THREE.Vector2(x, y)]
      )[0];

      // shift the point by 1/2 RASDimensions in each dimension
      pointIn3D.x += volume.RASDimensions[0] / 2;
      pointIn3D.y += volume.RASDimensions[1] / 2;

      // 11. Convert from 3D RAS space to ijk voxel space
      const ijk = [
        Math.floor(pointIn3D.x / volume.spacing[0]),
        Math.floor(pointIn3D.y / volume.spacing[1]),
        Math.floor(pointIn3D.z / volume.spacing[2]),
      ];

      //console.log({ pointIn3D, ijk });

      // 12. Get the voxel value at this ijk coordinate
      const voxelValue = volume.getData(ijk[0], ijk[1], ijk[2]);

      // 13. Set the pixel color based on the voxel value
      data[i] = voxelValue;
      data[i + 1] = voxelValue;
      data[i + 2] = voxelValue;
      data[i + 3] = 255;
    } else {
      outsideCnt++;
    }

    // data[i] = isInside ? 255 : 0;
    // data[i + 1] = 0;
    // data[i + 2] = 0;
    // data[i + 3] = isInside ? 255 : 0;
  }

  ctx2.putImageData(imageData, 0, 0);

  // 10. Create a new texture from the canvas
  const canvasMap2 = new THREE.CanvasTexture(canvas2);
  // canvasMap2.minFilter = THREE.LinearFilter;
  // canvasMap2.generateMipmaps = true;
  // canvasMap2.wrapS = canvasMap2.wrapT = THREE.ClampToEdgeWrapping;
  // canvasMap2.colorSpace = THREE.SRGBColorSpace;

  // 11. Create a new PlaneGeometry with the dimensions calculated
  const planeGeometry3 = new THREE.PlaneGeometry(xLength, yLength);
  const planeMaterial3 = new THREE.MeshBasicMaterial({
    map: canvasMap2,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const planeMesh2 = new THREE.Mesh(planeGeometry3, planeMaterial3);
  planeMesh2.lookAt(plane.normal);

  // TODO: figure out why the flip is needed
  planeMesh2.scale.multiply(new THREE.Vector3(1, -1, 1));
  scene.add(planeMesh2);

  meshesToRemove.push(planeMesh2);
}

function animate() {
  controls.update();

  drawPlane();

  renderer.render(scene, camera);
}
