'use strict';
const fs = require('fs');
const path = require('path');
const analyzer = require('../src/renderer/shared/analyzer.js');
const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));

// Test function
function rankAugments(augments, state, dataset, options) {
  const opts = options || {};
  const currentUnits = (state && (state.board || state.units)) || [];
  const hp = state && typeof state.hp === 'number' ? state.hp : 100;
  const gold = state && typeof state.gold === 'number' ? state.gold : 50;
  const stage = String((state && state.stage) || '2-1');
  const items = (state && (state.items || state.inventory)) || [];
  
  const traitsActive = analyzer.traitBreakdown(currentUnits, dataset || fb);
  const activeTraitNames = traitsActive.active.map(t => t.name.toLowerCase());
  const inactiveTraitNames = traitsActive.inactive.map(t => t.name.toLowerCase());

  return (augments || []).map(aug => {
    let score = 50; // base score
    let reasons = [];
    const tags = aug.tags || [];
    const tier = aug.tier || 'gold';
    const text = (aug.name + ' ' + aug.desc).toLowerCase();

    // 1. Stage logic
    if (stage.startsWith('2-')) {
      if (tags.includes('econ') || tags.includes('xp')) {
        score += 25;
        reasons.push('Đầu trận (2-1) chọn lõi kinh tế/kinh nghiệm giúp tích lũy lợi tức và lên cấp sớm');
      }
      if (tags.includes('reroll')) {
        score += 15;
        reasons.push('Phù hợp nếu định hướng chơi bài reroll tướng 1-2 vàng');
      }
    } else if (stage.startsWith('3-')) {
      if (tags.includes('emblem')) {
        score += 20;
        reasons.push('Giữa trận (3-2) lấy Ấn/Mốc tộc hệ giúp định hình khung bài vững chắc');
      }
      if (tags.includes('combat')) {
        score += 15;
        reasons.push('Tăng cường sức mạnh giao tranh giữ máu giữa trận');
      }
    } else if (stage.startsWith('4-') || stage.startsWith('5-')) {
      if (tags.includes('combat')) {
        score += 30;
        reasons.push('Cuối trận (4-2+) ưu tiên tối đa chỉ số giao tranh để tranh top');
      }
      if (tags.includes('items')) {
        score += 20;
        reasons.push('Bổ sung trang bị hoàn chỉnh cho các chủ lực cuối trận');
      }
      if (tags.includes('econ') && hp < 50) {
        score -= 25;
        reasons.push('Máu thấp ở cuối trận không nên chọn lõi kinh tế chậm');
      }
    }

    // 2. HP & Gold Context
    if (hp <= 40) {
      if (tags.includes('combat') || tags.includes('items')) {
        score += 25;
        reasons.push('Máu đang ở ngưỡng nguy hiểm (<40), cần sức mạnh tức thì để tránh bị loại');
      }
      if (tags.includes('econ') && !text.includes('gain') && !text.includes('nhận ngay')) {
        score -= 30;
        reasons.push('Máu quá thấp, không đủ thời gian phát huy lõi tăng trưởng kinh tế');
      }
    } else if (hp >= 80) {
      if (tags.includes('econ') || tags.includes('xp')) {
        score += 15;
        reasons.push('Máu dồi dào (>80), an toàn để đánh chuỗi hoặc tích lũy kinh tế mạnh mẽ');
      }
    }

    if (gold < 15 && tags.includes('econ')) {
      score += 15;
      reasons.push('Kinh tế đang thiếu hụt, lõi hỗ trợ hồi phục tài chính');
    }

    // 3. Trait & Comp Synergy
    const assocTraits = (aug.associatedTraits || []).map(t => t.toLowerCase());
    let traitMatch = false;
    assocTraits.forEach(t => {
      if (activeTraitNames.includes(t)) {
        score += 35;
        traitMatch = true;
        reasons.push(`Kích hoạt và bổ trợ trực tiếp cho tộc hệ đang chơi (${t})`);
      } else if (inactiveTraitNames.includes(t)) {
        score += 15;
        traitMatch = true;
        reasons.push(`Có thể kích hoạt thêm mốc cho tộc hệ dự bị (${t})`);
      }
    });

    if (tags.includes('emblem') && !traitMatch && assocTraits.length > 0) {
      score -= 30;
      reasons.push('Ấn tộc hệ không khớp với bất kỳ tướng nào trên sân');
    }

    // 4. Recommendation label
    let recommendation = 'situational';
    if (score >= 80) recommendation = 'must_pick';
    else if (score >= 65) recommendation = 'recommended';
    else if (score < 40) recommendation = 'avoid';

    return {
      augment: aug,
      score: Math.max(0, Math.min(100, Math.round(score))),
      tier: tier,
      tags: tags,
      recommendation: recommendation,
      reason: reasons.join('. ') || 'Lõi cân bằng chỉ số tổng thể.'
    };
  }).sort((a, b) => b.score - a.score);
}

// Test scenario
const sampleState = {
  stage: '4-2',
  hp: 35,
  gold: 20,
  board: [
    { name: 'Cassiopeia', cost: 3, traits: ['Spellcaster', 'Arcanist'] },
    { name: 'Rammus', cost: 3, traits: ['Defender', 'Vanguard'] }
  ]
};

const sampleAugments = [
  fb.augments.find(a => a.name.includes('Focused Fire') || a.apiName.includes('FocusedFire')),
  fb.augments.find(a => a.name.includes('Kingslayer') || a.apiName.includes('Kingslayer')),
  fb.augments.find(a => a.name.includes('Hedge Fund') || a.apiName.includes('HedgeFund'))
].filter(Boolean);

console.log('Sample Augments Ranked:');
const ranked = rankAugments(sampleAugments, sampleState, fb);
ranked.forEach(r => {
  console.log(`\n[${r.augment.name}] Score: ${r.score} (${r.recommendation.toUpperCase()})`);
  console.log(`Tags: ${r.tags.join(', ')} | Tier: ${r.tier}`);
  console.log(`Reason: ${r.reason}`);
});
