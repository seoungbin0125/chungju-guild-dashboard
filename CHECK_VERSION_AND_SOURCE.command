#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "버전: $(node -e "console.log(require('./package.json').version)")"
node - <<'NODE'
const data = require('./data/latest.json');
const guildWar = require('./data/guild-war.json');
const members = data.members.filter((member) => member.guild === '충주시');
console.log(`충주시 길드원: ${members.length}명`);
console.log(`수집 기준: ${data.dataSource || '-'}`);
console.log(`충주시 URL: ${(data.sourceUrls || {})['충주시'] || '-'}`);
console.log(`토벌 주차: ${data.raidPeriod?.metricLabel || '-'} / ${data.raidPeriod?.scoreWeekKey || '-'}`);
const powerRankCount = members.filter((member) => member.serverPowerRank != null).length;
const raidRankCount = members.filter((member) => member.serverTobeolRank != null).length;
console.log(`Scania 4 서버 순위: 투력 ${powerRankCount}/${members.length}명 · 토벌 ${raidRankCount}/${members.length}명`);
console.log(`개인 대항전: 이번 주 ${guildWar.summary?.currentKnownCount || 0}/${guildWar.summary?.rosterCount || 0}명 · 지난주 ${guildWar.summary?.previousKnownCount || 0}명 · 비교 ${guildWar.summary?.comparedCount || 0}명`);
console.log('TOP 5:');
for (const m of members.slice(0, 5)) console.log(`${m.rank}. ${m.nickname} ${m.job} Lv.${m.level} ${m.powerText} · 서버 투력 #${m.serverPowerRank || '-'} · 서버 토벌 #${m.serverTobeolRank || '-'}`);
NODE
