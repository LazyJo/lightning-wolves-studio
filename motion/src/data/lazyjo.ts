// Mirrors the Lazy Jo profile in client/src/data/wolves.ts — keep in sync.

export type Cosign = {
  name: string;
  quote: string;
  platform: string;
  photo: string;
  focus?: string;
};

export const COSIGNS: Cosign[] = [
  { name: "Timbaland", quote: "This could be the best song", platform: "YouTube", photo: "assets/cosigns/timbaland.jpg", focus: "50% 30%" },
  { name: "Symba", quote: "International as a M*****f*****r", platform: "YouTube", photo: "assets/cosigns/symba.jpg", focus: "50% 35%" },
  { name: "DDG", quote: "Next Up", platform: "Instagram", photo: "assets/cosigns/ddg.jpg", focus: "50% 25%" },
  { name: "Zaytoven", quote: "Liked the post", platform: "Instagram", photo: "assets/cosigns/zaytoven.jpg", focus: "40% 30%" },
  { name: "Kelvyn Colt", quote: "Go get it my g!!", platform: "DM on Instagram", photo: "assets/cosigns/kelvyn-colt.jpg", focus: "50% 25%" },
  { name: "Kid Hazel", quote: "Them songs was hard on ya page fam", platform: "DM on Instagram", photo: "assets/cosigns/kid-hazel.jpg", focus: "50% 40%" },
];
