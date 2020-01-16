let astData: any = {};
const coverageData = [];

export function saveAstData(data) {
  astData = data;
}

export function getAstData() {
  return astData;
}

export function saveCoverageData(data) {
  coverageData.push(data);
}

export function getCoverageData() {
  return coverageData;
}
