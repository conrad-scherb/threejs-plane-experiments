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

// const plane = new THREE.Plane(new THREE.Vector3(SQRT1_3, SQRT1_3, SQRT1_3), 0);

// 4-intersection cut
const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

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

  // // Also draw a simple axial slice
  // const axialSlice1 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.dimensions[2] / 4)
  // );

  // const axialSlice2 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.dimensions[2] / 2)
  // );

  // const axialSlice3 = volume.extractSlice(
  //   "z",
  //   Math.floor(volume.dimensions[2] / 1)
  // );
  // scene.add(axialSlice1.mesh);
  // scene.add(axialSlice2.mesh);
  // scene.add(axialSlice3.mesh);

  // meshesToRemove.push(axialSlice1.mesh);
  // meshesToRemove.push(axialSlice2.mesh);
  // meshesToRemove.push(axialSlice3.mesh);

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
    const spacings = [0, 1, 2].map(
      (idx) => Math.abs(components[idx]) * spacing[idx]
    );
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

  const xLengthInPixels = Math.ceil(xLength / xAxisSpacing);
  const yLengthInPixels = Math.ceil(yLength / yAxisSpacing);

  // 8. Create a new canvas with the dimensions calculated
  const canvas2 = document.createElement("canvas");
  canvas2.width = xLengthInPixels;
  canvas2.height = yLengthInPixels;
  const ctx2 = canvas2.getContext("2d");

  // 9. Fill the canvas buffer
  const imageData = ctx2.createImageData(xLengthInPixels, yLengthInPixels);
  const data = imageData.data;

  //document.body.appendChild(canvas2);

  const windowLow = 0;
  const windowHigh = 3952;

  const pointsPolygon = new Flatten.Polygon(
    intersectionsIn2D.map((point) => new Flatten.Point(point.x, point.y))
  );

  for (let i = 0; i < data.length; i += 4) {
    // Check if this point in 2D is inside the intersectionsIn2D
    const x = ((i / 4) % xLengthInPixels) * xAxisSpacing + minX;
    const y = Math.floor(i / 4 / xLengthInPixels) * yAxisSpacing + minY;

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
      pointIn3D.z += volume.RASDimensions[2] / 2;

      // 11. Convert from 3D RAS space to ijk voxel space
      const ijk = [
        Math.floor(pointIn3D.x / volume.spacing[0]),
        Math.floor(pointIn3D.y / volume.spacing[1]),
        Math.floor(pointIn3D.z / volume.spacing[2]),
      ];

      // 12. Get the voxel value at this ijk coordinate
      const voxelValue = volume.getData(ijk[0], ijk[1], ijk[2]);

      // 13. Apply windowing to voxel value
      const windowedValue = Math.floor(
        (255 * (voxelValue - windowLow)) / (windowHigh - windowLow)
      );

      // 14. Set the pixel color based on the voxel value
      data[i] = windowedValue;
      data[i + 1] = windowedValue;
      data[i + 2] = windowedValue;
      data[i + 3] = 255;
    } else {
      // make pixel blue to clearly show outside bounds
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }

  ctx2.putImageData(imageData, 0, 0);

  // 10. Create a new texture from the canvas
  const canvasMap2 = new THREE.CanvasTexture(canvas2);
  canvasMap2.minFilter = THREE.LinearFilter;
  canvasMap2.generateMipmaps = true;
  canvasMap2.wrapS = canvasMap2.wrapT = THREE.ClampToEdgeWrapping;
  canvasMap2.colorSpace = THREE.SRGBColorSpace;

  // 11. Create a new PlaneGeometry with the dimensions calculated
  const planeGeometry3 = new THREE.PlaneGeometry(xLength, yLength);
  const planeMaterial3 = new THREE.MeshBasicMaterial({
    map: canvasMap2,
    side: THREE.DoubleSide,
    transparent: true,
  });

  // !!! make the planeGeometry3 look at the plane normal
  planeGeometry3.lookAt(plane.normal);

  // 12. Rotate the PlaneGeometry such that the top left corner of the plane
  //     is at the first intersection point

  // Extract the vertices of the PlaneGeometry
  const planeVertexPositionsBuffer = planeGeometry3.getAttribute("position");
  const planeVertexPositions = [];

  for (let i = 0; i < planeVertexPositionsBuffer.count; i++) {
    const vertex = new THREE.Vector3(
      planeVertexPositionsBuffer.getX(i),
      planeVertexPositionsBuffer.getY(i),
      planeVertexPositionsBuffer.getZ(i)
    );

    planeVertexPositions.push(vertex);
  }

  // Find the length of the first edge
  const planeGeometryEdgeLength = planeVertexPositions[1].distanceTo(
    planeVertexPositions[0]
  );

  // Find the edges of the intersectionBoundingRectIn3D

  // let rotationAngle = 0;
  // for (let i = 0; i < intersectionBoundingRectIn3D.length; i++) {
  //   const edgeLength = intersectionBoundingRectIn3D[i].distanceTo(
  //     intersectionBoundingRectIn3D[
  //       (i + 1) % intersectionBoundingRectIn3D.length
  //     ]
  //   );

  //   if (Math.abs(edgeLength - planeGeometryEdgeLength) < 0.1) {
  //     // Find the angle between these two edges
  //     const edge1 = intersectionBoundingRectIn3D[i]
  //       .clone()
  //       .sub(
  //         intersectionBoundingRectIn3D[
  //           (i + 1) % intersectionBoundingRectIn3D.length
  //         ]
  //       );
  //     const edge2 = planeVertexPositions[1]
  //       .clone()
  //       .sub(planeVertexPositions[0]);

  //     rotationAngle = edge1.angleTo(edge2) + Math.PI / 2;

  //     console.log(
  //       "Found matching edge in degrees ",
  //       rotationAngle * (180 / Math.PI)
  //     );

  //     break;
  //   }
  // }

  // Project the PlaneGeometry corners into 2D space
  const planeGeometryVertices = [];
  const planeGeometryVertexBuffer = planeGeometry3.getAttribute("position");

  for (let i = 0; i < planeGeometryVertexBuffer.count; i++) {
    // TODO: figure out why these are flipped
    const vertex = new THREE.Vector3(
      planeGeometryVertexBuffer.getZ(i),
      planeGeometryVertexBuffer.getY(i),
      planeGeometryVertexBuffer.getX(i)
    );

    planeGeometryVertices.push(vertex);
  }

  const planeCornersIn2D = intersectionsTo2DSpace(
    plane.normal,
    planeGeometryVertices
  );

  function findSideLengths(points) {
    const sides = [
      new THREE.Vector3().copy(points[0]).sub(points[1]),
      new THREE.Vector3().copy(points[1]).sub(points[2]),
      new THREE.Vector3().copy(points[2]).sub(points[3]),
      new THREE.Vector3().copy(points[3]).sub(points[0]),
    ];

    return sides.map((s) => s.length());
  }

  function findShortSide(points) {
    const sides = [
      new THREE.Line3(points[0], points[1]),
      new THREE.Line3(points[1], points[2]),
      new THREE.Line3(points[2], points[3]),
      new THREE.Line3(points[3], points[0]),
    ];

    return sides.reduce((a, b) => (a.distance() < b.distance() ? a : b));
  }
  const orderedPlaneGeometryVertices = [
    planeGeometryVertices[0],
    planeGeometryVertices[1],
    planeGeometryVertices[3],
    planeGeometryVertices[2],
  ];

  const side1 = findShortSide(orderedPlaneGeometryVertices);
  const side2 = findShortSide(intersectionBoundingRectIn3D);

  const s1Lengths = findSideLengths(orderedPlaneGeometryVertices);
  const s2Lengths = findSideLengths(intersectionBoundingRectIn3D);

  // const diff = side1.angleTo(side2);
  // const diffInDegrees = diff * (180 / Math.PI);

  // Draw a thick line around the plane geometry short side
  const lineGeometry = new THREE.BufferGeometry();
  const lineVertices = new Float32Array(6);

  lineVertices[0] = side1.start.x;
  lineVertices[1] = side1.start.y;
  lineVertices[2] = side1.start.z;

  lineVertices[3] = side1.end.x;
  lineVertices[4] = side1.end.y;
  lineVertices[5] = side1.end.z;

  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(lineVertices, 3)
  );
  //orange
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffa500 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(line);

  console.log({
    boundingRectVectors,
    //diffInDegrees,
    side1,
    side2,
    s1Lengths,
    s2Lengths,
  });

  // 13. Create a new mesh with the PlaneGeometry and PlaneMaterial
  const planeMesh3 = new THREE.Mesh(planeGeometry3, planeMaterial3);
  //planeMesh3.lookAt(plane.normal);
  // planeMesh3.scale.multiply(new THREE.Vector3(1, -1, 1));

  scene.add(planeMesh3);
  meshesToRemove.push(planeMesh3);
}

function animate() {
  controls.update();

  drawPlane();

  renderer.render(scene, camera);
}
