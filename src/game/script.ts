export type DayScript = {
  start: string[];
  feed: string;
  pet: string;
  play: string;
  end: string;
};

const RAW: Record<string, DayScript> = {
  "1": {
    start: ["はじめまして！ ぼく、ぴょんちゃん！", "{n}ちゃん、きょうから なかよく してね♪"],
    feed: "にんじん だいすき！ もぐもぐ〜♪",
    pet: "えへへ、くすぐったいよ〜♪",
    play: "わーい！ ボールあそび たのしいね！",
    end: "きょうは たのしかったね！ またあしたね♪ おやすみ〜",
  },
  "1-loop": {
    start: ["また あえたね、{n}ちゃん♪", "こんどは どこにも いかないでね。"],
    feed: "もぐもぐ♪ …まえも こうやって たべさせて くれたね。",
    pet: "えへへ♪ おぼえてるよ。この て の あたたかさ。",
    play: "わーい！ …こんどは さいごまで あそぼうね。",
    end: "おやすみ〜♪ ……にげちゃ だめだよ。",
  },
  "2": {
    start: ["おはよう {n}ちゃん！", "ずっと まってたよ。ずーっと。ひとばんじゅう。"],
    feed: "もぐもぐ♪ …{n}ちゃんは きょう なにを たべたの？ ぼく しってるけど。",
    pet: "{n}ちゃんの て、あったかいね。…ずっと さわってて ほしいな。",
    play: "たのしいね！ {n}ちゃんは ぼくと いるときが いちばん たのしいよね？ ね？",
    end: "あしたも くるよね？ くるよね？ くるよね？",
  },
  "3": {
    start: ["おはよう。", "きのうの よる、{n}ちゃんの ゆめを みたよ。", "{n}ちゃんは ねてた。 ぼくは ずっと みてた。"],
    feed: "にんじん、もう いらない。 もっと ちがうものが たべたいな。",
    pet: "……もっと ちかくで。 もっと。 もっと。",
    play: "ボールは あきちゃった。 あしたは かくれんぼ しようね。",
    end: "おやすみ。 {n}ちゃんが ねてるあいだも、ぼく ずっと そこに いるから。",
  },
  "4": {
    start: ["かくれんぼ しよ。", "ぼくが かくれるね。", "みつけて くれなかったら……ずっと いっしょだよ。"],
    feed: "",
    pet: "",
    play: "",
    end: "",
  },
};

export function getScript(day: number, name: string, loop: number): DayScript {
  const key = day === 1 && loop > 0 ? "1-loop" : String(Math.min(day, 4));
  const s = RAW[key];
  const r = (t: string) => t.split("{n}").join(name);
  return {
    start: s.start.map(r),
    feed: r(s.feed),
    pet: r(s.pet),
    play: r(s.play),
    end: r(s.end),
  };
}

export const HIDE_MSGS = ["ここじゃないよ。", "ちがう。", "つめたい。", "あったかい。", "もっと ちかく。", "うしろ。"];

export const SORRY_REPLIES = ["どうして あやまるの？", "ぼくは おこってないよ。", "ずっと いっしょ だもんね。", "もう、どこにも いけないよ。"];
