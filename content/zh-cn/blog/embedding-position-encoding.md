---
title: "Embedding 与位置编码"
date: 2026-09-28T18:00:00+08:00
draft: false
isCJKLanguage: true
slug: "embedding-position-encoding"
tags: ["LLM", "Embedding", "位置编码", "RoPE"]
categories: ["LLM基础架构"]
description: "从字符编码、Embedding 到绝对位置编码、ALiBi 与 RoPE，梳理 NTK、YaRN 等长上下文方法和现代模型的设计。"
summary: "从离散符号到语义向量，再到序列中的位置关系：理解 Embedding、RoPE 及其长上下文扩展，并对照 Llama、Mistral、Qwen、DeepSeek 和 Kimi Linear 的具体设计。"
---

> **本文摘要**
>
> 字符编码解决“如何存储文本”，Embedding 解决“如何表示 token”，位置编码帮助模型利用“先后与距离”。本文沿着这三层关系，梳理绝对位置编码、相对位置方法、RoPE 及其长上下文扩展。

## 计算机如何编码文本

- **ASCII：** 使用 7 位表示 128 个字符，编号为 0–127。
- **Unicode：** 为字符分配码点（code point），例如汉字、字母及表情符号；一个显示出来的字符也可能由多个码点组合而成。

| 编码方式 | 每个 Unicode 标量值占用 | 特征 |
| --- | --- | --- |
| UTF-8 | 1–4 字节 | 变长；兼容 ASCII |
| UTF-16 | 2 或 4 字节 | 变长；1 或 2 个 16 位码元 |
| UTF-32 | 4 字节 | 定长 |

## One-hot：离散词表的直接表示

设词表大小为 $V$，第 $t$ 个 token 的 one-hot 向量为 $\boldsymbol{o}_t\in\mathbb{R}^V$：第 $t$ 个分量为 1，其余为 0。不同 token 满足 $\boldsymbol{o}_i^\top\boldsymbol{o}_j=0$（$i\ne j$），因此 **这种表示本身没有编码语义相似性** 。当词表包含数万甚至数十万个 token 时，向量维数高且十分稀疏。

## Embedding：从 token ID 到稠密向量

**定义：嵌入查表**

给定可学习矩阵 $E\in\mathbb{R}^{V\times d_e}$，token $t$ 的嵌入为

$$
\boldsymbol{x}_t=E^\top\boldsymbol{o}_t\in\mathbb{R}^{d_e}.
$$

实现时直接取 $E$ 的第 $t$ 行，无须显式构造 one-hot 向量。$d_e$ 依模型而定，例如 512 或 4096，并没有固定在某个区间。

嵌入参数通过训练学习语义与使用模式，某些关系可近似表现为向量方向或偏移，但 **线性类比不是普遍定律** 。标准输入嵌入对同一 token ID 返回相同向量，本身不含位置信息；经过模型各层后，表示才进一步依赖上下文。

## 位置编码：把顺序与距离交给模型

忽略位置相关信号和掩码时，纯自注意力对输入排列是等变的：改变 token 的排列，输出也随之排列。位置方法为模型引入明确的顺序或距离信息。

本文统一用 $m,n$ 表示从 0 开始的位置索引；$d_e$ 表示 token 嵌入维数，$d_h$ 表示单个注意力头的 Q/K 维数。

### 绝对位置：在输入端加入位置向量

典型做法是 $\boldsymbol{h}_m=\boldsymbol{x}_{t_m}+\boldsymbol{p}_m$，其中 $t_m$ 是位置 $m$ 的 token ID，$\boldsymbol{p}_m\in\mathbb{R}^{d_e}$ 是该位置的向量。

**正弦位置编码**

当 $d_e$ 为偶数时，对 $r=0,\dots,d_e/2-1$：

$$
 p_{m,2r}=\sin\!\left(\frac{m}{10000^{2r/d_e}}\right),\qquad
 p_{m,2r+1}=\cos\!\left(\frac{m}{10000^{2r/d_e}}\right).
$$

不同频率刻画不同尺度的位置变化。公式可计算训练范围以外的位置，但不保证模型能可靠外推。

**可学习位置编码**

学习矩阵 $P\in\mathbb{R}^{L_{\max}\times d_e}$，取第 $m$ 行作为 $\boldsymbol{p}_m$。超过预设表长时没有对应参数，通常需要扩展、插值或重新训练，不能直接查表外推。

### 相对位置：直接改变注意力分数

对某个注意力头，基础分数为

$$
 a_{mn}=\frac{\boldsymbol{q}_m^\top\boldsymbol{k}_n}{\sqrt{d_h}}.
$$

- **相对位置偏置：** 使用 $a'_{mn}=a_{mn}+b_{m-n}$。偏置可以按距离精确索引，也可将距离划入若干桶后查表。
- **ALiBi：** 在因果注意力允许的 $n\le m$ 范围内，令

  $$
  a_{mn}^{(h)}=\frac{(\boldsymbol{q}_m^{(h)})^\top\boldsymbol{k}_n^{(h)}}{\sqrt{d_h}}
    -\alpha_h(m-n),\qquad \alpha_h>0.
  $$

  各头使用不同斜率，使较远的历史位置受到不同程度的惩罚。因果掩码仍单独处理未来位置。

> **分析**
>
> **绝对位置** 回答“当前是第几个 token”，**相对位置** 突出“两者相隔多远”。相对位置偏置、ALiBi 与 RoPE 属于不同实现，不能把它们都理解成在输入嵌入上加一个向量。

## RoPE：用旋转让内积携带相对位置

### 旋转作用在注意力的 Q/K 上

标准 RoPE 先获得注意力的 query 和 key，再按位置旋转其二维分量对；通常不旋转 value。以下用完整旋转一个偶数维注意力头的情形说明，部分维度旋转的变体采用相同原理。

设频率基数为 $\beta>1$，第 $r$ 对分量使用角频率

$$
 \omega_r=\beta^{-2r/d_h},\qquad r=0,\dots,d_h/2-1.
$$

其位置 $m$ 对应的旋转块为

$$
 R_r(m)=
 \begin{pmatrix}
   \cos(m\omega_r)&-\sin(m\omega_r)\\
   \sin(m\omega_r)&\cos(m\omega_r)
 \end{pmatrix}.
$$

把所有块组合为 $R(m)$，得到 $\widetilde{\boldsymbol{q}}_m=R(m)\boldsymbol{q}_m$、$\widetilde{\boldsymbol{k}}_n=R(n)\boldsymbol{k}_n$。若用复数表示一个二维分量对，旋转等价于乘以 $e^{\mathrm{i}m\omega_r}$。

**分析**

旋转矩阵满足 $R(m)^\top R(n)=R(n-m)$，所以

$$
\widetilde{\boldsymbol{q}}_m^\top\widetilde{\boldsymbol{k}}_n
=\boldsymbol{q}_m^\top R(n-m)\boldsymbol{k}_n.
$$

内积中由位置引入的部分只依赖相对位移 $n-m$；内容向量 $\boldsymbol{q}_m,\boldsymbol{k}_n$ 仍各自携带上下文信息。对两端同时平移相同位置，旋转项保持不变。

### 为什么长上下文仍会遇到问题

RoPE 可以计算任意位置的旋转，但训练只覆盖有限的位置和距离分布。直接把推理长度扩大，模型可能遇到不熟悉的相位组合及注意力模式，导致困惑度（PPL）升高、检索或生成质量下降；严重程度依模型、长度和训练方案而异。

> **备注**
>
> **“公式能算出来”不等于“模型已经学会”。** RoPE 提供相对位置结构，长上下文能力还依赖频率设置、长度扩展方法及相应训练。

### 线性位置插值：统一压缩位置尺度

若希望把上下文窗口扩大 $s>1$ 倍，线性位置插值（Position Interpolation, PI）用 $m/s$ 替代 $m$：

$$
 \phi'_{m,r}=\frac{m}{s}\omega_r
            =m\frac{\omega_r}{s}.
$$

因此它等价于把所有频率统一除以 $s$，让更长的位置区间映射回原有相位范围。代价是每一对分量中相邻位置的角度差都缩小，局部位置分辨率发生变化，短上下文效果也可能受到影响；实践中常结合长文本微调。

### NTK-aware 与动态 NTK：改变频率基数

一种常见的 NTK-aware 基数缩放形式为

$$
 \beta'=\beta\,s^{d_h/(d_h-2)},\qquad d_h>2.
$$

将 $\beta'$ 代入 RoPE 频率公式后，$r=0$ 的最高频率保持不变，其余频率按维度发生不同幅度的缩放，最慢频率缩小为原来的 $1/s$。这比统一压缩所有频率更有针对性。

**动态 NTK** 进一步让基数随当前序列长度调整。具体公式依实现而异；若基数在生成过程中改变，缓存中的 key 与新 query 必须使用一致的旋转约定，不能混用不同基数下的表示。

> **备注**
>
> 这里的“高频”指较小分量对索引 $r$ 对应的较快旋转；“低频”指较大 $r$ 对应的较慢旋转。**NTK-aware 并不等同于按三个频段硬划分** ，后者更接近下面的分段混合思路。

### YaRN：分频段混合，并调整注意力尺度

用混合权重 $\gamma_r\in[0,1]$ 可概括其频率处理：

$$
 \omega'_r=\gamma_r\omega_r+(1-\gamma_r)\frac{\omega_r}{s}.
$$

- **高频段：** $\gamma_r=1$，保留原始频率及局部变化。
- **低频段：** $\gamma_r=0$，采用线性插值后的频率。
- **中间频段：** 平滑过渡，混合两种频率。

YaRN 还结合注意力温度／幅度缩放，调整 softmax 前分数的尺度，以改善长度变化时的注意力分布。扩展上下文仍需结合相应训练与评测。

## 现代模型：按具体版本理解设计选择

同一模型家族的不同版本可能使用不同位置与注意力机制。以下按代表性实现整理相关线索。

**Llama 3：提高 RoPE 基数。** 相较早期常见的 $\beta=10000$，Llama 3 使用 $\beta=500000$，改变较慢旋转分量的频率。更大的基数并不自动保证任意长度的外推。

**Mistral 7B：滑动窗口注意力（SWA）。** 每层的每个位置只直接关注窗口内的历史 token；堆叠多层后，信息仍能通过中间表示传播到更远处。SWA 控制注意力范围，可与 RoPE 同时使用。

**Qwen2-VL：多模态旋转位置编码（M-RoPE）。** 将位置维度按时间、高度、宽度组织，为文本、图像与视频提供位置表示。这是多模态版本的设计，不应泛指全部 Qwen 文本模型。

**DeepSeek-V2：MLA 与解耦 RoPE。** 通过低秩潜变量压缩 key/value 信息，并把语义相关的内容部分与携带 RoPE 的位置部分分开处理，以兼顾压缩与位置信息；不是直接对压缩后的全部内容维度施加 RoPE。

**Kimi Linear：KDA 与 MLA 的混合架构。** 2025 年论文中的模型按 3:1 的层数比例混合 KDA 与全局 MLA。其全局 MLA 层采用 NoPE，不显式加入位置编码，由 KDA 的状态递推与衰减机制传递顺序和远近信息。这个结论针对 Kimi Linear，不能泛化为整个 Kimi 家族都放弃 RoPE。

> **本文要点**
>
> - **表示：** Unicode 编码 → 分词与 token ID → Embedding。
> - **位置：** 绝对位置向量、相对偏置、ALiBi、RoPE 各有作用位置。
> - **扩展：** PI 统一缩放，NTK-aware 调整基数，YaRN 按频段混合并调整注意力尺度。
> - **架构：** 位置编码、注意力窗口与 KV 压缩分别解决不同问题，可以组合使用。

## 参考

1. [Tongyun1：语义的几何与时空的折叠（原笔记所引文章）](https://github.com/Tongyun1/from-minimind-to-more/blob/main/%E5%9F%BA%E7%9F%B3%EF%BC%9A%E8%AF%AD%E4%B9%89%E7%9A%84%E5%87%A0%E4%BD%95%E4%B8%8E%E6%97%B6%E7%A9%BA%E7%9A%84%E6%8A%98%E5%8F%A0%EF%BC%9AEmbedding%E4%B8%8E%E4%BD%8D%E7%BD%AE%E7%BC%96%E7%A0%81.md)。
2. [RoFormer](https://arxiv.org/abs/2104.09864)；[ALiBi](https://arxiv.org/abs/2108.12409)；[Position Interpolation](https://arxiv.org/abs/2306.15595)；[YaRN](https://arxiv.org/abs/2309.00071)。
3. [The Llama 3 Herd of Models](https://arxiv.org/abs/2407.21783)；[Mistral 7B](https://arxiv.org/abs/2310.06825)；[Qwen2-VL](https://arxiv.org/abs/2409.12191)；[DeepSeek-V2](https://arxiv.org/abs/2405.04434)。
4. [Kimi Linear: An Expressive, Efficient Attention Architecture](https://arxiv.org/abs/2510.26692)，模型结构及第 6.1 节的位置编码说明。
