{
  "npcs": {
    "merchant_001": {
      "id": "merchant_001",
      "name": "王掌柜",
      "type": "merchant",
      "description": "一位和气的商人，经营着各种杂货。",
      "location": "central",
      "dialogue": {
        "greeting": "这位少侠，需要些什么吗？我这里货物齐全，价格公道。",
        "farewell": "欢迎下次光临！",
        "topics": {
          "rumors": "听说最近城外不太平，有山贼出没，少侠要小心啊。",
          "business": "这年头生意不好做啊，税赋又重，只能勉强糊口。"
        }
      },
      "inventory": ["herb_001", "herb_002", "wine_001", "book_001"],
      "quests": ["quest_003"]
    },
    "guard_001": {
      "id": "guard_001",
      "name": "张守卫",
      "type": "guard",
      "description": "襄阳城的守卫，负责维护城内秩序。",
      "location": "central",
      "dialogue": {
        "greeting": "站住！什么人？哦，是位江湖人士啊，请遵守城内规矩。",
        "farewell": "小心行事，莫要惹是生非。",
        "topics": {
          "rumors": "最近城内治安尚可，但城外不太平，少侠要出城的话多加小心。",
          "duty": "我们守卫责任重大，既要维护秩序，又要防范外敌。"
        }
      },
      "quests": ["quest_001"]
    },
    "elder_001": {
      "id": "elder_001",
      "name": "李老丈",
      "type": "elder",
      "description": "一位在广场散步的老者，看起来见识广博。",
      "location": "central",
      "dialogue": {
        "greeting": "年轻人，看你气度不凡，定是江湖中人吧？",
        "farewell": "江湖路远，少侠珍重。",
        "topics": {
          "rumors": "老夫年轻时也曾闯荡江湖，听闻少林寺的易筋经乃是武林至宝。",
          "advice": "练武之人，内功根基最为重要，切莫只追求招式华丽。"
        }
      },
      "quests": ["quest_009"]
    },
    "tavern_keeper": {
      "id": "tavern_keeper",
      "name": "醉仙楼主",
      "type": "merchant",
      "description": "醉仙楼的老板，看起来精明能干。",
      "location": "tavern",
      "dialogue": {
        "greeting": "客官里面请！本店有上等好酒，还有各地名菜。",
        "farewell": "客官慢走，欢迎下次再来！",
        "topics": {
          "rumors": "前几天有位神秘剑客在此饮酒，剑法之高，老夫生平罕见。",
          "business": "这醉仙楼传了三代，南来北往的客人见得多了。"
        }
      },
      "inventory": ["wine_001", "wine_002", "food_001"],
      "quests": ["quest_002"]
    },
    "wandering_swordsman": {
      "id": "wandering_swordsman",
      "name": "流浪剑客",
      "type": "warrior",
      "description": "一位独来独往的剑客，眼神中透着沧桑。",
      "location": "tavern",
      "dialogue": {
        "greeting": "...（默默喝酒，看了你一眼）",
        "farewell": "...（继续喝酒）",
        "topics": {
          "rumors": "江湖...不过是个名利场。",
          "advice": "剑法的最高境界，不在于招式，而在于心。"
        }
      },
      "quests": ["quest_010"]
    },
    "weapon_merchant": {
      "id": "weapon_merchant",
      "name": "铁匠张",
      "type": "merchant",
      "description": "兵器铺的老板，肌肉结实，一看就是打铁的好手。",
      "location": "market",
      "dialogue": {
        "greeting": "少侠要看兵器吗？我这里刀枪剑戟样样俱全！",
        "farewell": "好兵器是武者的第二生命，选一把趁手的吧！",
        "topics": {
          "rumors": "听说西域传来一种玄铁，打造的兵器锋利无比。",
          "business": "打铁三十年了，什么样的兵器没打过？"
        }
      },
      "inventory": ["weapon_001", "weapon_002"],
      "quests": ["quest_011"]
    },
    "herb_merchant": {
      "id": "herb_merchant",
      "name": "药铺李",
      "type": "merchant",
      "description": "药材铺的老板，精通各种草药特性。",
      "location": "market",
      "dialogue": {
        "greeting": "少侠需要药材吗？疗伤补气，应有尽有！",
        "farewell": "身体是革命的本钱，少侠保重！",
        "topics": {
          "rumors": "青云山上有一种血灵芝，疗伤效果极佳，但极难采摘。",
          "business": "这药材啊，讲究产地和采摘时节，差一点都不行。"
        }
      },
      "inventory": ["herb_001", "herb_002", "herb_003"],
      "quests": ["quest_012"]
    },
    "official_001": {
      "id": "official_001",
      "name": "王主簿",
      "type": "official",
      "description": "官府的文官，负责处理文书和悬赏事宜。",
      "location": "government",
      "dialogue": {
        "greeting": "这位少侠，是来接悬赏任务的吗？",
        "farewell": "若有线索，速来禀报。",
        "topics": {
          "rumors": "最近江洋大盗'黑风煞'猖獗，已有多起案件。",
          "duty": "维护一方平安，是我等职责所在。"
        }
      },
      "quests": ["quest_004"]
    },
    "herbalist_001": {
      "id": "herbalist_001",
      "name": "采药人",
      "type": "commoner",
      "description": "一位在城外采药的老人，对附近草药分布很熟悉。",
      "location": "outskirts",
      "dialogue": {
        "greeting": "年轻人，这山中草药虽多，但也要小心野兽啊。",
        "farewell": "天色不早了，老夫该回去了。",
        "topics": {
          "rumors": "黑风林深处有一种罕见的龙涎草，但那里有猛兽出没。",
          "advice": "采药要讲究时节，春采花，夏采叶，秋采果，冬采根。"
        }
      },
      "quests": ["quest_005"]
    }
  },
  "enemies": {
    "bandit_001": {
      "id": "bandit_001",
      "name": "山贼喽啰",
      "type": "human",
      "description": "普通的山贼，武功平平但心狠手辣。",
      "level": 3,
      "stats": {
        "health": 60,
        "internal": 20,
        "attack": 12,
        "defense": 8,
        "agility": 6
      },
      "skills": ["basic_attack"],
      "loot": {
        "gold": [5, 15],
        "items": [
          {"id": "herb_001", "chance": 40},
          {"id": "weapon_001", "chance": 10}
        ]
      },
      "exp": 25
    },
    "bandit_002": {
      "id": "bandit_002",
      "name": "山贼头目",
      "type": "human",
      "description": "山贼的头目，武功较高，心机深沉。",
      "level": 8,
      "stats": {
        "health": 120,
        "internal": 40,
        "attack": 22,
        "defense": 15,
        "agility": 10
      },
      "skills": ["basic_attack", "heavy_attack"],
      "loot": {
        "gold": [30, 80],
        "items": [
          {"id": "herb_002", "chance": 60},
          {"id": "weapon_002", "chance": 30},
          {"id": "armor_002", "chance": 20}
        ]
      },
      "exp": 80
    },
    "wolf_001": {
      "id": "wolf_001",
      "name": "野狼",
      "type": "beast",
      "description": "凶猛的野狼，速度快，攻击性强。",
      "level": 2,
      "stats": {
        "health": 40,
        "internal": 0,
        "attack": 10,
        "defense": 5,
        "agility": 12
      },
      "skills": ["claw_attack"],
      "loot": {
        "gold": [0, 0],
        "items": [
          {"id": "pelt_001", "chance": 70},
          {"id": "meat_001", "chance": 50}
        ]
      },
      "exp": 15
    },
    "tiger_001": {
      "id": "tiger_001",
      "name": "猛虎",
      "type": "beast",
      "description": "山中猛虎，力大无穷，极其危险。",
      "level": 10,
      "stats": {
        "health": 200,
        "internal": 0,
        "attack": 35,
        "defense": 20,
        "agility": 15
      },
      "skills": ["claw_attack", "pounce"],
      "loot": {
        "gold": [0, 0],
        "items": [
          {"id": "pelt_001", "chance": 100},
          {"id": "meat_001", "chance": 80},
          {"id": "herb_003", "chance": 20}
        ]
      },
      "exp": 150
    }
  }
}
