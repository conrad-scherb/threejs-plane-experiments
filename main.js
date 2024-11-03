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

function createSimpleBox() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

  material.clippingPlanes = [plane];
  cube = new THREE.Mesh(geometry, material);
  // cube.visible = false;
  const box = new THREE.BoxHelper(cube);
  // scene.add(box);
  scene.add(cube);
}

let planeMesh = null;

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

  dots.forEach((dot) => scene.remove(dot));

  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  });
  planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  planeMesh.lookAt(plane.normal);
  scene.add(planeMesh);

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

  console.log(edges);

  // draw all the edges
  edges.forEach((edge) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          edge.start.x,
          edge.start.y,
          edge.start.z,
          edge.end.x,
          edge.end.y,
          edge.end.z,
        ]),
        3
      )
    );
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
  });

  const origin = new THREE.Vector3(0, 0, 0);

  const intersectionPoints = edges
    .map((edge) => {
      const intersection = new THREE.Vector3();
      plane.intersectLine(edge, intersection);
      return intersection;
    })
    .filter((i) => !i.equals(origin));
  // .filter((v1, i, arr) => arr.findIndex((v2) => v1.equals(v2)) === i)
  // .filter((intersection) => plane.distanceToPoint(intersection) === 0);

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
}

function animate() {
  controls.update();

  createSimpleBox();
  drawPlane();

  renderer.render(scene, camera);
}
