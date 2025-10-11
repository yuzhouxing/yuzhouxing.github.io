{
  "quests": {
    "quest_001": {
      "id": "quest_001",
      "name": "城内治安",
      "type": "fetch",
      "description": "张守卫请你帮忙调查城内的一起盗窃案。",
      "startLocation": "central",
      "startNPC": "guard_001",
      "objectives": [
        {
          "id": "obj_001",
          "description": "与市集的商人交谈，了解盗窃案详情",
          "type": "talk",
          "target": "merchant_001",
          "location": "market"
        },
        {
          "id": "obj_002",
          "description": "在城内寻找可疑人物",
          "type": "explore",
          "location": "central"
        }
      ],
      "rewards": {
        "exp": 100,
        "gold": 50,
        "items": ["herb_002"]
      },
      "minLevel": 2
    },
    "quest_002": {
      "id": "quest_002",
      "name": "醉仙楼的困扰",
      "type": "fetch",
      "description": "醉仙楼主请你帮忙采购一批上等食材。",
      "startLocation": "tavern",
      "startNPC": "tavern_keeper",
      "objectives": [
        {
          "id": "obj_003",
          "description": "前往市集购买食材",
          "type": "buy",
          "item": "food_001",
          "count": 5
        }
      ],
      "rewards": {
        "exp": 80,
        "gold": 30,
        "items": ["wine_001", "wine_001"]
      },
      "minLevel": 1
    },
    "quest_003": {
      "id": "quest_003",
      "name": "商人的请求",
      "type": "escort",
      "description": "王掌柜请你护送一批货物到城外村庄。",
      "startLocation": "central",
      "startNPC": "merchant_001",
      "objectives": [
        {
          "id": "obj_004",
          "description": "护送货物安全到达王家村",
          "type": "escort",
          "location": "village"
        },
        {
          "id": "obj_005",
          "description": "击退途中出现的山贼",
          "type": "defeat",
          "enemy": "bandit_001",
          "count": 3
        }
      ],
      "rewards": {
        "exp": 150,
        "gold": 100,
        "items": ["weapon_002"]
      },
      "minLevel": 4
    },
    "quest_004": {
      "id": "quest_004",
      "name": "通缉黑风煞",
      "type": "bounty",
      "description": "官府悬赏捉拿江洋大盗黑风煞。",
      "startLocation": "government",
      "startNPC": "official_001",
      "objectives": [
        {
          "id": "obj_006",
          "description": "在黑风林找到黑风煞的藏身处",
          "type": "explore",
          "location": "forest"
        },
        {
          "id": "obj_007",
          "description": "击败黑风煞",
          "type": "defeat",
          "enemy": "bandit_002",
          "count": 1
        }
      ],
      "rewards": {
        "exp": 300,
        "gold": 200,
        "items": ["armor_002", "herb_003"]
      },
      "minLevel": 6
    },
    "quest_005": {
      "id": "quest_005",
      "name": "采集灵药",
      "type": "gather",
      "description": "采药人请你帮忙采集一种罕见的草药。",
      "startLocation": "outskirts",
      "startNPC": "herbalist_001",
      "objectives": [
        {
          "id": "obj_008",
          "description": "在青云山采集血灵芝",
          "type": "gather",
          "item": "herb_003",
          "count": 3
        }
      ],
      "rewards": {
        "exp": 120,
        "gold": 80,
        "items": ["herb_004", "book_001"]
      },
      "minLevel": 5
    },
    "quest_006": {
      "id": "quest_006",
      "name": "清除山贼",
      "type": "hunt",
      "description": "清除黑风林中的山贼，保护过往行人安全。",
      "startLocation": "forest",
      "startNPC": "hunter_001",
      "objectives": [
        {
          "id": "obj_009",
          "description": "击败黑风林中的山贼",
          "type": "defeat",
          "enemy": "bandit_001",
          "count": 5
        }
      ],
      "rewards": {
        "exp": 200,
        "gold": 120,
        "items": ["weapon_002"]
      },
      "minLevel": 4
    },
    "quest_007": {
      "id": "quest_007",
      "name": "村庄的求助",
      "type": "hunt",
      "description": "王家村的村民请求你清除村外威胁村民安全的野兽。",
      "startLocation": "village",
      "startNPC": "villager_001",
      "objectives": [
        {
          "id": "obj_010",
          "description": "击败村外徘徊的野狼",
          "type": "defeat",
          "enemy": "wolf_001",
          "count": 3
        }
      ],
      "rewards": {
        "exp": 80,
        "gold": 40,
        "items": ["herb_001", "herb_001", "herb_001"]
      },
      "minLevel": 2
    },
    "quest_008": {
      "id": "quest_008",
      "name": "山中高人",
      "type": "story",
      "description": "寻找隐居在青云山的高人，学习更高深的武学。",
      "startLocation": "mountains",
      "startNPC": "hermit_001",
      "objectives": [
        {
          "id": "obj_011",
          "description": "登上青云山顶峰",
          "type": "explore",
          "location": "mountain_peak"
        },
        {
          "id": "obj_012",
          "description": "通过高人的考验",
          "type": "complete_trial"
        }
      ],
      "rewards": {
        "exp": 500,
        "skills": ["energy_blast"]
      },
      "minLevel": 10
    }
  }
}
