{
  "skills": {
    "basic_sword": {
      "id": "basic_sword",
      "name": "基础剑法",
      "type": "attack",
      "subtype": "sword",
      "level": 1,
      "description": "最基础的剑法招式，虽然简单但实用。",
      "effect": {
        "type": "damage",
        "baseDamage": 10,
        "scaling": {
          "attack": 1.0
        }
      },
      "cost": {
        "internal": 5
      },
      "requirements": {
        "level": 1
      },
      "icon": "sword_basic"
    },
    "heavy_attack": {
      "id": "heavy_attack",
      "name": "重击",
      "type": "attack",
      "subtype": "physical",
      "level": 1,
      "description": "凝聚力量的重击，造成大量伤害但消耗较高。",
      "effect": {
        "type": "damage",
        "baseDamage": 20,
        "scaling": {
          "attack": 1.2
        }
      },
      "cost": {
        "internal": 12
      },
      "requirements": {
        "level": 3
      },
      "icon": "attack_heavy"
    },
    "internal_cultivation": {
      "id": "internal_cultivation",
      "name": "基础内功",
      "type": "passive",
      "subtype": "internal",
      "level": 1,
      "description": "基础的内功修炼法门，能够提升内力上限和恢复速度。",
      "effect": {
        "type": "stat_boost",
        "stats": {
          "internal": 10
        }
      },
      "requirements": {
        "level": 1
      },
      "icon": "internal_basic"
    },
    "basic_qinggong": {
      "id": "basic_qinggong",
      "name": "基础轻功",
      "type": "passive",
      "subtype": "movement",
      "level": 1,
      "description": "基础的轻功技巧，能够提升移动速度和闪避能力。",
      "effect": {
        "type": "stat_boost",
        "stats": {
          "agility": 5
        }
      },
      "requirements": {
        "level": 2
      },
      "icon": "qinggong_basic"
    },
    "healing_hands": {
      "id": "healing_hands",
      "name": "疗伤掌",
      "type": "support",
      "subtype": "healing",
      "level": 1,
      "description": "运用内力疗伤的基础法门，能够恢复少量生命值。",
      "effect": {
        "type": "heal",
        "baseHeal": 15,
        "scaling": {
          "wisdom": 0.5
        }
      },
      "cost": {
        "internal": 8
      },
      "requirements": {
        "level": 4,
        "wisdom": 10
      },
      "icon": "heal_basic"
    },
    "sword_dance": {
      "id": "sword_dance",
      "name": "剑舞",
      "type": "attack",
      "subtype": "sword",
      "level": 2,
      "description": "华丽的剑法连招，能够连续攻击敌人多次。",
      "effect": {
        "type": "multi_hit",
        "hits": 3,
        "baseDamage": 5,
        "scaling": {
          "attack": 0.7,
          "agility": 0.3
        }
      },
      "cost": {
        "internal": 15
      },
      "requirements": {
        "level": 8,
        "agility": 12
      },
      "icon": "sword_dance"
    },
    "iron_body": {
      "id": "iron_body",
      "name": "铁布衫",
      "type": "defense",
      "subtype": "physical",
      "level": 2,
      "description": "运功硬化身体，短时间内大幅提升防御力。",
      "effect": {
        "type": "buff",
        "stat": "defense",
        "amount": 10,
        "duration": 3
      },
      "cost": {
        "internal": 10
      },
      "requirements": {
        "level": 6,
        "defense": 15
      },
      "icon": "defense_iron"
    },
    "energy_blast": {
      "id": "energy_blast",
      "name": "气功波",
      "type": "attack",
      "subtype": "internal",
      "level": 3,
      "description": "将内力凝聚后发出，造成内功伤害。",
      "effect": {
        "type": "damage",
        "baseDamage": 25,
        "scaling": {
          "wisdom": 1.5
        },
        "damageType": "internal"
      },
      "cost": {
        "internal": 20
      },
      "requirements": {
        "level": 12,
        "wisdom": 20
      },
      "icon": "internal_blast"
    }
  }
}
