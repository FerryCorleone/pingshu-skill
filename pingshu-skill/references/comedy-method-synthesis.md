# 包袱方法综合：给 Agent 的便携版

这份参考用于把评书、相声和脱口秀的方法压成可执行写作流程。不要照搬任何艺人的段子或口头禅。

## 核心判断

现代评书不能只学“列位看官”和古风腔。真正有效的路径是：

```text
事实 -> 戏剧关系 -> 人物压力 -> 可见动作 -> 生活化错位 -> 包袱落点 -> 继续叙事
```

评书负责连续叙事和场面，相声负责包袱组织和捧逗，脱口秀负责 setup/punch、误导、三段式和 callback。

## 写每个包袱前先做 7 步

1. **事实锚点**：这个笑点依赖哪个已确认事实、动作、原话或结果？
2. **普通预期**：正常情况下观众以为接下来会怎样？
3. **社会情绪**：这里是谁丢面子、谁心虚、谁被忽视、谁装稳、谁要找补？
4. **可见承载物**：用手、眼神、物件、距离、停顿或围观反应承载笑点。
5. **生活化错位**：把宏大设定翻成房租、开会、手续、排队、师徒、面子或职场。
6. **最后抖响**：把 punch 放在句末、段末或真实停顿之后。
7. **回到剧情**：抖完立刻交代后果和下一步，不让包袱变成停车场。

## 内心戏

用户想要的“好笑、抽象、人物有戏”，很大一部分来自内心戏翻译。

```text
可见动作 -> 当场压力 -> 那意思像是... -> 立刻回到事实
```

示例骨架：

```text
他手伸出去又缩回来。那意思像是脑子里临时开会：拿吧，显得馋；不拿吧，白来。
```

真人热点里必须使用缓冲表达：`像是`、`仿佛`、`你要搁现场看大概是这个味儿`。不要把没有来源的动机写死。

## 单人捧逗

评书是单人表演，但说书人可以自己抛问题、自己接问题。

```text
您说这事儿坏在哪？
坏就坏在，他不是没准备。
他准备得挺充分。
就是准备了半天，准备的是沉默。
```

问句后适合在 `performance_plan.events` 里加 500-800 ms `pause`。

## 三段递进

借相声“三翻四抖”和脱口秀 rule of three 的共同逻辑：

```text
第一下建立正常。
第二下强化正常。
第三下突然落到荒唐但具体的生活细节。
```

第三下必须帮助理解剧情，不要为了凑笑点脱离事实。

## 误导

误导是 setup 先建立一种解释，punch 再揭示另一种解释也成立。

```text
setup：他不是没看见。
punch：他是看见了，还非得往前凑。
```

误导要短，不能让观众忘了主线。

## Callback

callback 只能回扣已经有效的词、物件或判断，而且必须换语境。

```text
前文：礼貌先下班了。
后文：等结果出来，礼貌又上班了，只不过这回网友加班。
```

原样重复不是回扣。回扣要让前文的小笑点变成后文的新后果。

## 重写循环

给每个关键 beat 先写 5 个候选：

- 身份账本版；
- 日常规则错位版；
- 内心戏版；
- 三段递进版；
- callback 或后文伏笔版。

删掉下面几类：

- 换个故事也能用的；
- 只靠粗口、方言或老派套话的；
- 把真人动机写死的；
- 影响事实清晰度的；
- TTS 念出来会拧巴的。

宁可留下一个真包袱，也不要每句都假装有梗。

## 外部参考

- [北京评书 - 中国非物质文化遗产网](https://www.ihchina.cn/project_details/13685/)
- [相声 - 中国非物质文化遗产网](https://www.ihchina.cn/project_details/13669.html)
- [非遗中国：相声 - 新浪文化](https://culture.sina.cn/2019-03-19/detail-ihsxncvh3740693.d.html?vt=4)
- [相声科普 - 北京旅游网](https://www.visitbeijing.com.cn/article/47QoCvH5WYY)
- [Chris Head: Misdirection](https://www.chrishead.com/post/2018/02/02/lesson-8-misdirection)
- [Chris Head: Rule Of Three, Callbacks & Anachronisms](https://www.chrishead.com/post/2018/04/27/lesson-17-comic-analogies)
- [Backstage: How to Use Callbacks in Your Comedy](https://www.backstage.com/magazine/article/callback-comedy-explained-76712/)
- [The Second City: Intro to Comedy Writing](https://www.secondcity.com/classes/virtual/online-classes/intro-comedy-writing-online-vir)
