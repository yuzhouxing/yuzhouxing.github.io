{
  "locations": {
    "central": {
      "id": "central",
      "name": "襄阳城",
      "description": "你站在襄阳城的中央广场上，四周人来人往，商贩叫卖声不绝于耳。东边是繁华的市集，西边是威严的官府，南边通往城外，北边则是武林人士聚集的酒楼。",
      "type": "city",
      "connections": {
        "north": "tavern",
        "south": "outskirts",
        "east": "market",
        "west": "government"
      },
      "actions": [
        {
          "id": "rest_central",
          "name": "休息片刻",
          "description": "在广场边的石凳上休息，恢复一些体力和内力。",
          "effect": {
            "type": "heal",
            "amount": 20
          },
          "cost": {
            "time": 1
          }
        },
        {
          "id": "observe_central",
          "name": "观察四周",
          "description": "仔细观察广场上的人们，或许能发现些什么。",
          "effect": {
            "type": "random_event",
            "events": [
              "你注意到一个神秘的黑衣人匆匆走过。",
              "你听到几个江湖人士在讨论最近的武林大会。",
              "你发现地上有一枚铜钱，顺手捡了起来。",
              "你看到一位老者在广场中央练剑，剑法精妙。"
            ]
          },
          "cost": {
            "time": 0.5
          }
        }
      ],
      "npcs": ["merchant_001", "guard_001", "elder_001"],
      "items": ["coin_001"],
      "quests": ["quest_001"],
      "minLevel": 1,
      "music": "city_theme"
    },
    "tavern": {
      "id": "tavern",
      "name": "醉仙楼",
      "description": "醉仙楼是襄阳城最有名的酒楼，各路武林人士在此饮酒论剑。你闻到阵阵酒香，听到江湖人士的高谈阔论。二楼似乎有几位高手在切磋武艺。",
      "type": "tavern",
      "connections": {
        "south": "central"
      },
      "actions": [
        {
          "id": "drink_tavern",
          "name": "饮酒",
          "description": "点一壶好酒，慢慢品尝。",
          "effect": {
            "type": "heal",
            "amount": 5
          },
          "cost": {
            "gold": 2
          }
        },
        {
          "id": "listen_tavern",
          "name": "偷听谈话",
          "description": "仔细聆听周围江湖人士的谈话，或许能获得一些情报。",
          "effect": {
            "type": "random_event",
            "events": [
              "你听说城外最近有山贼出没。",
              "你听到有人在讨论一本失传的武功秘籍。",
              "你了解到最近官府正在招募江湖人士。",
              "你听说少林寺正在举办武林大会。"
            ]
          },
          "cost": {
            "time": 0.5
          }
        },
        {
          "id": "challenge_tavern",
          "name": "切磋武艺",
          "description": "与酒楼中的武林人士切磋，提升实战经验。",
          "effect": {
            "type": "gain_exp",
            "amount": 15
          },
          "requirements": {
            "minLevel": 3
          },
          "cost": {
            "health": 10
          }
        }
      ],
      "npcs": ["tavern_keeper", "wandering_swordsman", "drunken_master"],
      "items": ["wine_001", "wine_002"],
      "quests": ["quest_002"],
      "minLevel": 1,
      "music": "tavern_theme"
    },
    "market": {
      "id": "market",
      "name": "市集",
      "description": "这里是襄阳城最繁华的市集，各种商品琳琅满目。你看到有卖兵器、药材、书籍的摊位，还有几个江湖艺人在表演杂技。",
      "type": "market",
      "connections": {
        "west": "central"
      },
      "actions": [
        {
          "id": "browse_market",
          "name": "逛摊位",
          "description": "在各个摊位间逛逛，看看有什么好东西。",
          "effect": {
            "type": "random_event",
            "events": [
              "你在一个旧书摊发现了一本基础内功心法。",
              "你看到一个兵器摊上有把不错的铁剑。",
              "你在药材摊前驻足，老板向你推荐了一些疗伤药。",
              "你遇到一个卖艺的小女孩，给了她几枚铜钱。"
            ]
          },
          "cost": {
            "time": 1
          }
        },
        {
          "id": "buy_herbs",
          "name": "购买草药",
          "description": "购买一些基础的疗伤草药。",
          "effect": {
            "type": "add_item",
            "item": "herb_001"
          },
          "cost": {
            "gold": 5
          }
        }
      ],
      "npcs": ["weapon_merchant", "herb_merchant", "book_merchant", "street_performer"],
      "items": ["herb_001", "book_001", "coin_002"],
      "quests": ["quest_003"],
      "minLevel": 1,
      "music": "market_theme"
    },
    "government": {
      "id": "government",
      "name": "官府",
      "description": "威严的官府门前站着两名持刀守卫。这里通常是处理公务和发布悬赏的地方，偶尔也会有江湖通缉令张贴在公告栏上。",
      "type": "government",
      "connections": {
        "east": "central"
      },
      "actions": [
        {
          "id": "read_notice",
          "name": "查看公告",
          "description": "查看官府门口的公告栏，了解最新的通缉令和悬赏。",
          "effect": {
            "type": "fixed_event",
            "message": "公告栏上贴着一张通缉令：悬赏捉拿江洋大盗\"黑风煞\"，赏金100两白银。"
          },
          "cost": {
            "time": 0.5
          }
        },
        {
          "id": "accept_bounty",
          "name": "接受悬赏",
          "description": "接受官府的悬赏任务，追捕通缉犯。",
          "effect": {
            "type": "start_quest",
            "quest": "quest_004"
          },
          "requirements": {
            "minLevel": 5
          },
          "cost": {
            "time": 1
          }
        }
      ],
      "npcs": ["guard_001", "guard_002", "official_001"],
      "items": [],
      "quests": ["quest_004"],
      "minLevel": 1,
      "music": "government_theme"
    },
    "outskirts": {
      "id": "outskirts",
      "name": "城外",
      "description": "你来到了襄阳城外，眼前是一片开阔的田野和远处的群山。这里空气清新，偶尔能看到一些农夫和旅人。远处似乎有一条小路通往深山。",
      "type": "wilderness",
      "connections": {
        "north": "central",
        "east": "forest",
        "west": "village",
        "south": "mountains"
      },
      "actions": [
        {
          "id": "train_outskirts",
          "name": "练习武功",
          "description": "在空旷的地方练习武功，提升自己的实力。",
          "effect": {
            "type": "gain_exp",
            "amount": 10
          },
          "cost": {
            "time": 1,
            "internal": 5
          }
        },
        {
          "id": "gather_herbs",
          "name": "采集草药",
          "description": "在野外寻找有用的草药。",
          "effect": {
            "type": "random_item",
            "items": [
              {"id": "herb_001", "chance": 60},
              {"id": "herb_002", "chance": 30},
              {"id": "herb_003", "chance": 10}
            ]
          },
          "cost": {
            "time": 1
          }
        }
      ],
      "npcs": ["farmer_001", "traveler_001", "herbalist_001"],
      "items": ["herb_002"],
      "quests": ["quest_005"],
      "minLevel": 1,
      "music": "wilderness_theme"
    },
    "forest": {
      "id": "forest",
      "name": "黑风林",
      "description": "这是一片茂密的森林，阳光透过树叶洒下斑驳的光影。林中传来鸟鸣声，但也隐约能听到野兽的吼叫。据说这里常有山贼出没。",
      "type": "wilderness",
      "connections": {
        "west": "outskirts",
        "east": "bandit_camp"
      },
      "actions": [
        {
          "id": "hunt_forest",
          "name": "狩猎",
          "description": "在森林中狩猎野兽，获取食物和材料。",
          "effect": {
            "type": "random_item",
            "items": [
              {"id": "meat_001", "chance": 70},
              {"id": "pelt_001", "chance": 40},
              {"id": "herb_002", "chance": 30}
            ]
          },
          "requirements": {
            "minLevel": 2
          },
          "cost": {
            "time": 1,
            "health": 5
          }
        },
        {
          "id": "explore_forest",
          "name": "探索森林",
          "description": "深入森林探索，可能会发现隐藏的地点或宝物。",
          "effect": {
            "type": "random_event",
            "events": [
              "你发现了一个隐蔽的山洞。",
              "你找到了一些野生草药。",
              "你遇到了一头野狼，经过一番搏斗后将其击退。",
              "你发现了一处古墓的入口。"
            ]
          },
          "requirements": {
            "minLevel": 3
          },
          "cost": {
            "time": 1,
            "health": 10
          }
        }
      ],
      "npcs": ["hunter_001", "bandit_001"],
      "items": ["herb_002", "pelt_001"],
      "quests": ["quest_006"],
      "minLevel": 2,
      "music": "forest_theme",
      "dangerLevel": 2
    },
    "village": {
      "id": "village",
      "name": "王家村",
      "description": "这是一个宁静的小村庄，村民们过着平静的生活。村中炊烟袅袅，孩子们在空地上玩耍，老人们坐在树下聊天。",
      "type": "village",
      "connections": {
        "east": "outskirts",
        "north": "village_elder"
      },
      "actions": [
        {
          "id": "help_villagers",
          "name": "帮助村民",
          "description": "帮助村民做一些力所能及的事情，获得他们的好感。",
          "effect": {
            "type": "gain_exp",
            "amount": 8
          },
          "cost": {
            "time": 1
          }
        },
        {
          "id": "rest_village",
          "name": "在村庄休息",
          "description": "在村民家中借宿，充分恢复体力和内力。",
          "effect": {
            "type": "full_restore"
          },
          "cost": {
            "time": 8,
            "gold": 3
          }
        }
      ],
      "npcs": ["villager_001", "villager_002", "child_001"],
      "items": ["food_001", "herb_001"],
      "quests": ["quest_007"],
      "minLevel": 1,
      "music": "village_theme"
    },
    "mountains": {
      "id": "mountains",
      "name": "青云山",
      "description": "高耸入云的山峰，云雾缭绕。山间小路崎岖难行，但据说山顶有高人隐居。山中偶尔传来虎啸声，令人不寒而栗。",
      "type": "wilderness",
      "connections": {
        "north": "outskirts",
        "up": "mountain_peak"
      },
      "actions": [
        {
          "id": "climb_mountains",
          "name": "攀登山峰",
          "description": "挑战险峻的山路，提升自己的轻功和体力。",
          "effect": {
            "type": "gain_exp",
            "amount": 20
          },
          "requirements": {
            "minAgility": 15
          },
          "cost": {
            "time": 2,
            "health": 15,
            "internal": 10
          }
        },
        {
          "id": "search_mountains",
          "name": "搜寻灵药",
          "description": "在深山老林中寻找珍贵的灵药。",
          "effect": {
            "type": "random_item",
            "items": [
              {"id": "herb_003", "chance": 40},
              {"id": "herb_004", "chance": 20},
              {"id": "herb_005", "chance": 5}
            ]
          },
          "requirements": {
            "minLevel": 5
          },
          "cost": {
            "time": 2,
            "health": 10
          }
        }
      ],
      "npcs": ["hermit_001", "tiger_001"],
      "items": ["herb_003", "herb_004"],
      "quests": ["quest_008"],
      "minLevel": 5,
      "music": "mountain_theme",
      "dangerLevel": 4
    }
  }
}
