{
  "items": {
    "currency": {
      "coin_001": {
        "id": "coin_001",
        "name": "铜钱",
        "type": "currency",
        "subtype": "coin",
        "value": 1,
        "description": "一枚普通的铜钱，可以在市集上购买一些小物件。",
        "icon": "coin",
        "stackable": true,
        "maxStack": 999
      },
      "coin_002": {
        "id": "coin_002",
        "name": "银两",
        "type": "currency",
        "subtype": "silver",
        "value": 100,
        "description": "一锭白银，价值不菲。",
        "icon": "silver",
        "stackable": true,
        "maxStack": 99
      },
      "coin_003": {
        "id": "coin_003",
        "name": "金元宝",
        "type": "currency",
        "subtype": "gold",
        "value": 10000,
        "description": "一锭金元宝，极为珍贵。",
        "icon": "gold",
        "stackable": true,
        "maxStack": 10
      }
    },
    "consumable": {
      "herb_001": {
        "id": "herb_001",
        "name": "止血草",
        "type": "consumable",
        "subtype": "healing",
        "value": 5,
        "description": "常见的止血草药，可以恢复少量生命值。",
        "effect": {
          "type": "heal",
          "amount": 20
        },
        "icon": "herb_common",
        "stackable": true,
        "maxStack": 20
      },
      "herb_002": {
        "id": "herb_002",
        "name": "凝气草",
        "type": "consumable",
        "subtype": "internal",
        "value": 8,
        "description": "能够帮助凝聚内力的草药，可以恢复少量内力。",
        "effect": {
          "type": "restore_internal",
          "amount": 15
        },
        "icon": "herb_internal",
        "stackable": true,
        "maxStack": 20
      },
      "herb_003": {
        "id": "herb_003",
        "name": "血灵芝",
        "type": "consumable",
        "subtype": "healing",
        "value": 50,
        "description": "珍贵的灵芝，可以恢复大量生命值。",
        "effect": {
          "type": "heal",
          "amount": 80
        },
        "icon": "herb_rare",
        "stackable": true,
        "maxStack": 10
      },
      "herb_004": {
        "id": "herb_004",
        "name": "龙涎草",
        "type": "consumable",
        "subtype": "internal",
        "value": 60,
        "description": "传说中的灵草，可以恢复大量内力。",
        "effect": {
          "type": "restore_internal",
          "amount": 70
        },
        "icon": "herb_legendary",
        "stackable": true,
        "maxStack": 10
      },
      "herb_005": {
        "id": "herb_005",
        "name": "九转还魂草",
        "type": "consumable",
        "subtype": "revive",
        "value": 500,
        "description": "传说中的仙草，能够起死回生，恢复全部生命和内力。",
        "effect": {
          "type": "full_restore"
        },
        "icon": "herb_miracle",
        "stackable": true,
        "maxStack": 5
      },
      "wine_001": {
        "id": "wine_001",
        "name": "醉仙酒",
        "type": "consumable",
        "subtype": "internal",
        "value": 10,
        "description": "醉仙楼的招牌酒，可以恢复少量内力。",
        "effect": {
          "type": "restore_internal",
          "amount": 15
        },
        "icon": "wine_common",
        "stackable": true,
        "maxStack": 10
      },
      "wine_002": {
        "id": "wine_002",
        "name": "女儿红",
        "type": "consumable",
        "subtype": "buff",
        "value": 25,
        "description": "陈年佳酿，饮用后短时间内提升攻击力。",
        "effect": {
          "type": "buff",
          "stat": "attack",
          "amount": 5,
          "duration": 300
        },
        "icon": "wine_rare",
        "stackable": true,
        "maxStack": 5
      }
    },
    "weapon": {
      "weapon_001": {
        "id": "weapon_001",
        "name": "木剑",
        "type": "weapon",
        "subtype": "sword",
        "value": 10,
        "description": "一把普通的木剑，适合初学者练习。",
        "stats": {
          "attack": 3
        },
        "requirements": {
          "level": 1
        },
        "icon": "wooden_sword",
        "equipable": true
      },
      "weapon_002": {
        "id": "weapon_002",
        "name": "铁剑",
        "type": "weapon",
        "subtype": "sword",
        "value": 50,
        "description": "一把标准的铁剑，锋利耐用。",
        "stats": {
          "attack": 8
        },
        "requirements": {
          "level": 3
        },
        "icon": "iron_sword",
        "equipable": true
      },
      "weapon_003": {
        "id": "weapon_003",
        "name": "精钢剑",
        "type": "weapon",
        "subtype": "sword",
        "value": 200,
        "description": "用精钢打造的剑，锋利无比。",
        "stats": {
          "attack": 15
        },
        "requirements": {
          "level": 8
        },
        "icon": "steel_sword",
        "equipable": true
      },
      "weapon_004": {
        "id": "weapon_004",
        "name": "青锋剑",
        "type": "weapon",
        "subtype": "sword",
        "value": 800,
        "description": "名匠打造的宝剑，剑身泛着青光。",
        "stats": {
          "attack": 25,
          "agility": 3
        },
        "requirements": {
          "level": 15
        },
        "icon": "fine_sword",
        "equipable": true
      }
    },
    "armor": {
      "armor_001": {
        "id": "armor_001",
        "name": "布衣",
        "type": "armor",
        "subtype": "cloth",
        "value": 5,
        "description": "普通的布衣，提供基本的防护。",
        "stats": {
          "defense": 2
        },
        "requirements": {
          "level": 1
        },
        "icon": "cloth_armor",
        "equipable": true
      },
      "armor_002": {
        "id": "armor_002",
        "name": "皮甲",
        "type": "armor",
        "subtype": "leather",
        "value": 30,
        "description": "用兽皮制作的护甲，轻便且有一定防护力。",
        "stats": {
          "defense": 5,
          "agility": 1
        },
        "requirements": {
          "level": 3
        },
        "icon": "leather_armor",
        "equipable": true
      },
      "armor_003": {
        "id": "armor_003",
        "name": "铁甲",
        "type": "armor",
        "subtype": "metal",
        "value": 120,
        "description": "铁制护甲，防护力强但较为笨重。",
        "stats": {
          "defense": 12,
          "agility": -2
        },
        "requirements": {
          "level": 8
        },
        "icon": "iron_armor",
        "equipable": true
      }
    },
    "accessory": {
      "accessory_001": {
        "id": "accessory_001",
        "name": "铁戒指",
        "type": "accessory",
        "subtype": "ring",
        "value": 20,
        "description": "一枚普通的铁戒指，略微提升攻击力。",
        "stats": {
          "attack": 1
        },
        "requirements": {
          "level": 2
        },
        "icon": "iron_ring",
        "equipable": true
      },
      "accessory_002": {
        "id": "accessory_002",
        "name": "玉坠",
        "type": "accessory",
        "subtype": "amulet",
        "value": 80,
        "description": "一枚温润的玉坠，能够提升内力恢复速度。",
        "stats": {
          "wisdom": 2
        },
        "requirements": {
          "level": 5
        },
        "icon": "jade_amulet",
        "equipable": true
      }
    },
    "material": {
      "pelt_001": {
        "id": "pelt_001",
        "name": "兽皮",
        "type": "material",
        "subtype": "pelt",
        "value": 3,
        "description": "普通的兽皮，可以用来制作皮甲。",
        "icon": "pelt",
        "stackable": true,
        "maxStack": 50
      },
      "meat_001": {
        "id": "meat_001",
        "name": "兽肉",
        "type": "material",
        "subtype": "meat",
        "value": 2,
        "description": "新鲜的兽肉，可以食用或出售。",
        "icon": "meat",
        "stackable": true,
        "maxStack": 20
      }
    },
    "book": {
      "book_001": {
        "id": "book_001",
        "name": "基础内功心法",
        "type": "book",
        "subtype": "skill",
        "value": 50,
        "description": "记载基础内功修炼方法的书籍，阅读后可以学习基础内功。",
        "effect": {
          "type": "learn_skill",
          "skill": "internal_cultivation"
        },
        "icon": "book_common",
        "consumable": true
      },
      "book_002": {
        "id": "book_002",
        "name": "基础剑法图谱",
        "type": "book",
        "subtype": "skill",
        "value": 40,
        "description": "记载基础剑法招式的图谱，阅读后可以学习基础剑法。",
        "effect": {
          "type": "learn_skill",
          "skill": "basic_sword"
        },
        "icon": "book_common",
        "consumable": true
      },
      "book_003": {
        "id": "book_003",
        "name": "轻功入门",
        "type": "book",
        "subtype": "skill",
        "value": 60,
        "description": "介绍轻功基础技巧的书籍，阅读后可以学习基础轻功。",
        "effect": {
          "type": "learn_skill",
          "skill": "basic_qinggong"
        },
        "icon": "book_common",
        "consumable": true
      }
    }
  }
}
