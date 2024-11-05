import { Vector2 } from "three";

export function intersectionsTo2DSpace(
  planeNormal,
  intersections,
  log = false
) {
  // Center the 2D coordinate system on the first intersection vector
  const origin = intersections[0];

  // The x-axis will be projected on the first to second intersection
  const xAxisUnitVector = intersections[1].clone().sub(origin).normalize();

  // The y-axis will be the cross product of the normal and x-axis
  const yAxisUnitVector = planeNormal
    .clone()
    .cross(xAxisUnitVector)
    .normalize();

  if (log) {
    console.log({ xAxisUnitVector, yAxisUnitVector });
  }

  // Represent each intersection in the 2D coordinate system
  const points = intersections.map((intersection) => {
    const x = intersection.clone().sub(origin).dot(xAxisUnitVector);
    const y = intersection.clone().sub(origin).dot(yAxisUnitVector);

    return new Vector2(x, y);
  });

  return points;
}

export function convert2DSpaceVectorsBackTo3D(
  planeNormal,
  intersections,
  vectorsIn2D
) {
  // The coordinate system was centered on the first intersection vector
  const origin = intersections[0];

  // The x-axis was projected on the first to second intersection
  const xAxisUnitVector = intersections[1].clone().sub(origin).normalize();

  // The y-axis was the cross product of the normal and x-axis
  const yAxisUnitVector = planeNormal
    .clone()
    .cross(xAxisUnitVector)
    .normalize();

  // Now our points as a Vector2 in x & y can be converted back to 3D
  const points = vectorsIn2D.map((point) => {
    const x = xAxisUnitVector.clone().multiplyScalar(point.x);
    const y = yAxisUnitVector.clone().multiplyScalar(point.y);

    return origin.clone().add(x).add(y);
  });

  return points;
}
