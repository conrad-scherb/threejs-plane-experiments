import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

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
controls.minDistance = 1;
controls.maxDistance = 2;
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 5;
controls.panSpeed = 2;

const plane = new THREE.Plane(
  new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2),
  0
);

const gui = new GUI();
gui.add(plane.normal, "x", -1, 1);
gui.add(plane.normal, "y", -1, 1);
gui.add(plane.normal, "z", -1, 1);

let cube = null;

const canvas = document.createElement("canvas");

// load a4c.jpeg and draw to canvas
const ctx = canvas.getContext("2d");
const img = new Image();
img.onload = function () {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
};
img.src = "https://i.imgur.com/7Fqs2mU.png";

document.body.appendChild(canvas);

function createSimpleBox() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

  material.clippingPlanes = [plane];
  cube = new THREE.Mesh(geometry, material);
  cube.visible = true;
  const box = new THREE.BoxHelper(cube);
  scene.add(box);
  scene.add(cube);
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

const dots = [];

function drawPlane() {
  if (planeMesh) {
    scene.remove(planeMesh);
  }

  if (intersectionsFaceMesh) {
    scene.remove(intersectionsFaceMesh);
  }

  dots.forEach((dot) => scene.remove(dot));

  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  });
  planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  planeMesh.lookAt(plane.normal);
  // scene.add(planeMesh);

  // Find the intersection of the plane with the cube
  const planeNormal = plane.normal;
  const planeConstant = plane.constant;

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
      size: 0.1,
      color: 0xff0000,
    });
    const dot = new THREE.Points(dotGeometry, dotMaterial);
    scene.add(dot);
    dots.push(dot);
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

  const uvs = new Float32Array(intersectionPoints.length * 6);

  for (let i = 0; i < intersectionPoints.length; i++) {
    const offset = i * 6;

    uvs[offset] = 0;
    uvs[offset + 1] = 0;

    uvs[offset + 2] = 1;
    uvs[offset + 3] = 0;

    uvs[offset + 4] = 0.5;
    uvs[offset + 5] = 1;
  }

  faceGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(faceVertices, 3)
  );

  faceGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

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
  const planeGeometry2 = new THREE.PlaneGeometry(1.4, 1.4);
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

  // // draw each clipping plane as a planeGeometry
  // const clippingPlaneGeometry = new THREE.PlaneGeometry(1, 1);
  // const clippingPlaneMaterial = new THREE.MeshBasicMaterial({
  //   color: 0xff0000,
  //   side: THREE.DoubleSide,
  // });

  // const clippingPlanesMeshes = [p1].map((plane) => {
  //   const clippingPlaneMesh = new THREE.Mesh(
  //     clippingPlaneGeometry,
  //     clippingPlaneMaterial
  //   );
  //   clippingPlaneMesh.lookAt(plane.normal);
  //   clippingPlaneMesh.position.copy(
  //     plane.normal.clone().multiplyScalar(plane.constant)
  //   );
  //   scene.add(clippingPlaneMesh);
  // });

  const clippingPlanes = [
    frontPlane,
    leftPlane,
    rightPlane,
    backPlane,
    topPlane,
    bottomPlane,
  ];

  // crate a 2x2 box and clip it with 6 planes
  const largeBoxGeometry = new THREE.BoxGeometry(2, 2, 2);
  const largeBoxMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
  });

  largeBoxMaterial.clippingPlanes = clippingPlanes;

  const largeBox = new THREE.Mesh(largeBoxGeometry, largeBoxMaterial);
  largeBox.position.set(0, 0, 0);
  scene.add(largeBox);

  planeMaterial2.clippingPlanes = clippingPlanes;
  planeMaterial2.clipIntersection = false;

  intersectionsFaceMesh = new THREE.Mesh(planeGeometry2, planeMaterial2);
  intersectionsFaceMesh.lookAt(plane.normal);
  scene.add(intersectionsFaceMesh);
}

function animate() {
  controls.update();

  createSimpleBox();
  drawPlane();

  renderer.render(scene, camera);
}
