const astData: any = [];
const coverageData = [];

export function saveAstData(data) {
  astData.push(data);
}

export function getAstData(index: number = 1) {
  if (astData.length < index) {
    return [];
  }

  return astData[astData.length - index];
}

export function saveCoverageData(data) {
  coverageData.push(data);
}

export function getCoverageData(uuid) {
  return coverageData.filter(it => it.runUuid === uuid);
}
