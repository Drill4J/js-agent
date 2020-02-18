const astData: any = [];
const coverageData = [];

export function saveAstData(data) {
  astData.push(data);
}

export function cleanAstData() {
  astData.length = 0;
}

export function cleanCoverageData() {
  coverageData.length = 0;
}

export function getAstData(branch: string = 'master') {
  const result = astData.filter(it => it.branch === branch);
  if (!result || result.length < 1) {
    return [];
  }

  return result[0];
}

export function saveCoverageData(data) {
  coverageData.push(data);
}

export function getCoverageData(branch) {
  return coverageData.filter(it => it.branch === branch);
}
