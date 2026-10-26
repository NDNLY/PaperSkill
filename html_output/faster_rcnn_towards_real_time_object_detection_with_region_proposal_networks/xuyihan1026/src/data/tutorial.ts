import type { TutorialData } from '../types';

export const tutorial: TutorialData = {
  "meta": {
    "titleEn": "Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks",
    "titleZh": "Faster R-CNN：用区域候选网络实现实时目标检测",
    "venue": "IEEE TPAMI · arXiv:1506.01497v3",
    "authors": "Shaoqing Ren, Kaiming He, Ross Girshick, Jian Sun (USTC · Microsoft Research)",
    "affiliation": "University of Science and Technology of China / Microsoft Research",
    "domain": "目标检测 / 区域候选网络",
    "coreProblem": "Fast R-CNN 让检测变快之后，候选框反而成了瓶颈：Selective Search 在 CPU 上要 2 秒一张图，比检测网络还慢。",
    "coreInsight": "让候选框也用神经网络算，并和检测器<b>共享同一份卷积特征</b>——用锚框当多尺度参照，候选框的边际成本只有约 10 毫秒。",
    "keywords": [
      "目标检测",
      "区域候选网络",
      "锚框",
      "特征共享",
      "实时检测"
    ]
  },
  "hero": {
    "oldMethod": {
      "desc": "<b>传统做法</b>：候选框靠 CPU 上的 Selective Search，每张图约 2 秒，成了瓶颈。",
      "componentId": "hero-old"
    },
    "newMethod": {
      "desc": "<b>本文方法</b>：RPN 与检测器共享卷积，300 个候选框，整机 198 ms。",
      "componentId": "hero-new"
    }
  },
  "chapters": [
    {
      "kind": "chapter",
      "id": "chap-1",
      "title": "老办法：逐格搬望远镜",
      "badge": "inf",
      "badgeLabel": "基础",
      "bridge": "建立「瓶颈在候选框」这一动机，并给出「共享卷积」这一解法方向。",
      "analogy": {
        "title": "一格一格搬望远镜",
        "text": "如果每一格都要把望远镜搬过去，光「找目标」就把时间用光了——<b>候选框就是那个瓶颈</b>。",
        "componentId": "ch1-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "1.1",
          "title": "瓶颈到底在哪",
          "desc": "按「开始对比」，让旧办法与共享特征的做法在同一条时间轴上跑一遍，看时间条与命中数。",
          "componentId": "ch1-mod1"
        }
      ],
      "insight": "要让候选框几乎免费，就得让它和检测网络看同一份特征，而不是另起一套。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "瓶颈转移",
          "desc": "Fast R-CNN 让检测变快，候选框反而成了瓶颈。"
        },
        {
          "icon": "🔧",
          "title": "解法方向",
          "desc": "用神经网络在共享特征上出候选框。"
        },
        {
          "icon": "✨",
          "title": "注意口径",
          "desc": "论文自己说 CPU 候选框与 GPU 检测器比速度并不公平。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-2",
      "title": "巡天相机扫出一张星图",
      "badge": "inf",
      "badgeLabel": "基础",
      "bridge": "把「共享特征」落到具体结构上。回答第 1 章之后的问题：候选框网络长什么样。",
      "analogy": {
        "title": "一格一格扫过去",
        "text": "巡天相机不挑地方，<b>每一格都要看一眼</b>，把看到的东西压成一小段特征。",
        "componentId": "ch2-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "2.1",
          "title": "每个格子里发生了什么",
          "desc": "拖动取景窗口在星图上移动，看窗口覆盖的格子、压出的特征向量长度、以及两条分支的输出。",
          "componentId": "ch2-mod1",
          "figure": "./images/fig3-rpn.png"
        }
      ],
      "insight": "这一层薄得几乎不花钱，所以它才有资格去看每一个位置。",
      "formula": {
        "lead": "每个窗口压出的特征会同时送进回归与分类两条分支。",
        "unicode": "cls: 2k 个分数　　reg: 4k 个坐标　　（k = 每个位置的锚框数）",
        "symbols": [
          {
            "sym": "k",
            "desc": "每个位置的锚框数（默认 9）"
          },
          {
            "sym": "2k",
            "desc": "分类输出维度"
          },
          {
            "sym": "4k",
            "desc": "回归输出维度"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "结构极轻",
          "desc": "3×3 窗口 + 两条 1×1 分支。"
        },
        {
          "icon": "🔧",
          "title": "特征维度",
          "desc": "ZF 256 维、VGG 512 维。"
        },
        {
          "icon": "✨",
          "title": "为什么能扫全图",
          "desc": "因为这一层便宜，才敢对每个位置都算。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-3",
      "title": "每格摆出九个取景框",
      "badge": "inf",
      "badgeLabel": "基础",
      "bridge": "这是全文最关键的设计。回答：多尺度怎么做到不花额外时间。",
      "analogy": {
        "title": "同一格，九个框",
        "text": "不用把望远镜推到不同距离，<b>在同一格准备几个大小不同的框</b>，总有一个合适。",
        "componentId": "ch3-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "3.1",
          "title": "为什么是九个框",
          "desc": "切换尺度与长宽比，看九个框如何覆盖同一颗星；点某个框看它的 IoU。",
          "componentId": "ch3-mod1"
        }
      ],
      "insight": "锚框把「尺度」变成了「参照物」，于是网络只需要学相对偏移。",
      "formula": {
        "lead": "九个锚框就是三种面积乘三种长宽比。",
        "unicode": "k = 3 scales × 3 aspect ratios = 9",
        "symbols": [
          {
            "sym": "k",
            "desc": "每个位置的锚框数"
          },
          {
            "sym": "scales",
            "desc": "面积 {128², 256², 512²}"
          },
          {
            "sym": "aspect ratios",
            "desc": "{1:1, 1:2, 2:1}"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "九个参照",
          "desc": "3 尺度 × 3 长宽比 = 9 个锚框。"
        },
        {
          "icon": "🔧",
          "title": "省掉金字塔",
          "desc": "不需要图像金字塔或滤波器金字塔。"
        },
        {
          "icon": "✨",
          "title": "代价可量化",
          "desc": "只用 1 个锚框会掉 3–4 个点 mAP。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-4",
      "title": "框住真星还是框住空处",
      "badge": "both",
      "badgeLabel": "基础 + 进阶",
      "bridge": "讲清「哪些框要学」。回答：锚框有了，怎么知道该学哪个。",
      "analogy": {
        "title": "框住星才算数",
        "text": "<b>IoU 高才是正样本，IoU 低才是负样本</b>，夹在中间的既不奖也不罚。",
        "componentId": "ch4-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "4.1",
          "title": "一个框算正还是算负",
          "desc": "点选星图上的几个框，看它的 IoU 落在哪一档、会得到什么标签。",
          "componentId": "ch4-mod1"
        }
      ],
      "insight": "正负样本的划分规则，决定了 RPN 到底在学什么。",
      "formula": {
        "lead": "两条阈值把锚框分成三档。",
        "unicode": "正样本：max IoU 或 IoU > 0.7　　负样本：所有 IoU &lt; 0.3　　其余：忽略",
        "symbols": [
          {
            "sym": "IoU",
            "desc": "交并比"
          },
          {
            "sym": "0.7",
            "desc": "正样本阈值"
          },
          {
            "sym": "0.3",
            "desc": "负样本阈值"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "自动标注",
          "desc": "标签由 IoU 规则生成，不用人工标。"
        },
        {
          "icon": "🔧",
          "title": "三档划分",
          "desc": "正、负、忽略三档。"
        },
        {
          "icon": "✨",
          "title": "细节理由",
          "desc": "还保留「IoU 最高」这一条，防止 0.7 阈值偶尔找不到正样本。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-5",
      "title": "两条损失一起算",
      "badge": "trn",
      "badgeLabel": "进阶",
      "bridge": "讲训练目标。回答：正负样本定了，网络到底优化什么。",
      "analogy": {
        "title": "两头都要顾",
        "text": "<b>「有没有星」和「框得准不准」是两件事</b>，用 λ 把两者的分量调平。",
        "componentId": "ch5-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "5.1",
          "title": "λ 调的是什么",
          "desc": "拖动 λ，看两条损失条与总损失如何变化；再对照论文报告的四个 λ 实测值。",
          "componentId": "ch5-mod1"
        }
      ],
      "insight": "分类和回归必须一起优化，但它们的相对权重并不需要精调。",
      "formula": {
        "lead": "分类项按批大小归一化，回归项按锚框位置数归一化，再乘 λ 相加。",
        "unicode": "L = (1/N_cls) Σ L_cls(p_i, p*_i) + λ · (1/N_reg) Σ p*_i · L_reg(t_i, t*_i)",
        "symbols": [
          {
            "sym": "p_i",
            "desc": "预测为物体的概率"
          },
          {
            "sym": "p*_i",
            "desc": "真值标签"
          },
          {
            "sym": "t_i",
            "desc": "预测框参数化坐标"
          },
          {
            "sym": "t*_i",
            "desc": "真值框坐标"
          },
          {
            "sym": "N_cls",
            "desc": "分类归一化（256）"
          },
          {
            "sym": "N_reg",
            "desc": "回归归一化（≈2400）"
          },
          {
            "sym": "λ",
            "desc": "平衡权重（10）"
          },
          {
            "sym": "L_cls",
            "desc": "两分类对数损失"
          },
          {
            "sym": "L_reg",
            "desc": "smooth L1"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "两项加权",
          "desc": "分类 + 回归，回归只在正样本上算。"
        },
        {
          "icon": "🔧",
          "title": "归一化",
          "desc": "分类按 256、回归按约 2400 归一化。"
        },
        {
          "icon": "✨",
          "title": "不敏感",
          "desc": "λ 在 1–100 之间只差约 1%。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-6",
      "title": "把框微调到刚好套住",
      "badge": "trn",
      "badgeLabel": "进阶",
      "bridge": "解释回归参数化。回答：网络怎么把框「挪准」。",
      "analogy": {
        "title": "往星的圆心挪一点",
        "text": "不直接报绝对坐标，而是<b>学「相对这个框该挪多少」</b>，学着更容易。",
        "componentId": "ch6-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "6.1",
          "title": "偏移量怎么变成框",
          "desc": "拖动 tx/ty/tw/th，看框如何从锚框移动、缩放，并观察 IoU 与公式里的对应关系。",
          "componentId": "ch6-mod1"
        }
      ],
      "insight": "学偏移比学绝对坐标容易得多，因为参照物已经给好了。",
      "formula": {
        "lead": "预测框与真值框都被表示成相对锚框的偏移。",
        "unicode": "t_x = (x − x_a)/w_a　t_y = (y − y_a)/h_a　t_w = log(w/w_a)　t_h = log(h/h_a)",
        "symbols": [
          {
            "sym": "x, y, w, h",
            "desc": "预测框中心与宽高"
          },
          {
            "sym": "x_a, y_a, w_a, h_a",
            "desc": "锚框"
          },
          {
            "sym": "t",
            "desc": "偏移量"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "相对表示",
          "desc": "学的是相对锚框的偏移，不是绝对坐标。"
        },
        {
          "icon": "🔧",
          "title": "中心与尺度分开",
          "desc": "中心除以宽高，宽高取对数。"
        },
        {
          "icon": "✨",
          "title": "分工",
          "desc": "k 个回归器各管一种尺度与长宽比，不共享权重。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-7",
      "title": "先巡天一遍，再只对候选精测",
      "badge": "both",
      "badgeLabel": "基础 + 进阶",
      "bridge": "说明为什么要分两阶段。回答：既然 RPN 能出框，为什么不直接一阶段分类。",
      "analogy": {
        "title": "先广域，再精测",
        "text": "广角相机看得广但看不清，望远镜看得清但慢——<b>分工才快</b>。",
        "componentId": "ch7-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "7.1",
          "title": "一阶段为什么差 4.8 个点",
          "desc": "切换两种流程，看命中率、耗时与每张图要处理的框数。",
          "componentId": "ch7-mod1"
        }
      ],
      "insight": "昂贵的那一步只该花在少数候选上，这就是两阶段的核心。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "差距",
          "desc": "两阶段 58.7%，一阶段 53.9%，差 4.8 个点。"
        },
        {
          "icon": "🔧",
          "title": "框数",
          "desc": "300 个候选 vs 20000 个稠密窗口。"
        },
        {
          "icon": "✨",
          "title": "结论",
          "desc": "分工让昂贵计算只落在少数候选上。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-8",
      "title": "整条夜巡链摊开看",
      "badge": "trn",
      "badgeLabel": "进阶",
      "bridge": "把各章零件组装成可点的整机图。",
      "analogy": {
        "title": "扣到同一台赤道仪上",
        "text": "巡天相机和望远镜<b>共用同一台赤道仪与星图</b>，才谈得上「候选框几乎免费」。",
        "componentId": "ch8-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "8.1",
          "title": "点一点，看谁在共享",
          "desc": "点击链条上的四个部件，看它的输入输出与是否共享；用芯片切换共享/不共享。",
          "componentId": "ch8-mod1",
          "figure": "./images/fig2-faster-rcnn.png"
        },
        {
          "kind": "module",
          "id": "8.2",
          "title": "四步交替训练",
          "desc": "切换步骤，看每一步谁被训练、谁被冻结。",
          "componentId": "ch8-mod2"
        }
      ],
      "insight": "共享特征是训练策略换来的，不是结构图上画出来的。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "四个部件",
          "desc": "共享卷积、RPN、RoI 池化、分类器。"
        },
        {
          "icon": "🔧",
          "title": "共享点",
          "desc": "两个阶段共用同一份卷积特征。"
        },
        {
          "icon": "✨",
          "title": "训练方式",
          "desc": "四步交替，把共享层「磨」到一起。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-9",
      "title": "同一颗星只留一次记录",
      "badge": "trn",
      "badgeLabel": "进阶",
      "bridge": "讲后处理与召回。回答：候选框太多怎么办、为什么 300 个够。",
      "analogy": {
        "title": "一颗星只留一条",
        "text": "同一个目标会被框很多次，<b>只留置信度最高的那一个</b>，其余压掉。",
        "componentId": "ch9-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "9.1",
          "title": "压到多少个才够",
          "desc": "拖动 NMS 的 IoU 阈值，看剩余框数、召回与 mAP 如何变化。",
          "componentId": "ch9-mod1"
        }
      ],
      "insight": "减少候选数量的安全做法，是按置信度排序后压掉重叠。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "NMS",
          "desc": "IoU 0.7 压到约 2000 个。"
        },
        {
          "icon": "🔧",
          "title": "只取前 300",
          "desc": "测试时 300 个框 mAP 依然高。"
        },
        {
          "icon": "✨",
          "title": "召回",
          "desc": "RPN 从 2000 减到 300 时召回下降平缓。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-10",
      "title": "这一夜的命中率与耗时",
      "badge": "both",
      "badgeLabel": "基础 + 进阶",
      "bridge": "收束全篇，给结果与边界。",
      "analogy": {
        "title": "同一起点的一夜",
        "text": "命中率和耗时都要看，<b>而且要比同样的口径</b>。",
        "componentId": "ch10-ana"
      },
      "modules": [
        {
          "kind": "module",
          "id": "10.1",
          "title": "快多少、准多少",
          "desc": "按「开始比较」跑一次竞速，切换三组已验证结果与边界说明。",
          "componentId": "ch10-mod1"
        }
      ],
      "insight": "真正被这篇改变的是「候选框不再是瓶颈」，而不只是多了几个点。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "VOC",
          "desc": "ZF 下 300 个框 59.9%，超过 SS 的 58.7%。"
        },
        {
          "icon": "🔧",
          "title": "速度",
          "desc": "VGG 整机 198 ms（约 5 fps）。"
        },
        {
          "icon": "✨",
          "title": "边界",
          "desc": "CPU/GPU 比速不公平，竞赛成绩含其他改进。"
        }
      ]
    }
  ]
};
