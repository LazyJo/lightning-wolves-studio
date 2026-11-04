/* JAVEDA in four languages: English, Nederlands, Français, Español.
   The page is written in English. This file changes the words the player sees - text, placeholders, titles,
   labels - into the chosen language as the page draws them (a MutationObserver), so the page's own code stays as
   it is. Song titles and the names of the games stay as they are, like names. Exact sentences come from S; text
   with numbers in it from the patterns in P; a message made of parts joined with " · " is done part by part.
   The language: the one picked here (localStorage "javeda.lang", shared with the levels), else the phone's,
   else English. The picker sits in the top bar; a new pick reloads the page. */
(function(){
"use strict";
const LANGS = [["en", "EN"], ["nl", "NL"], ["fr", "FR"], ["es", "ES"]];
const pick = () => { try { const s = localStorage.getItem("javeda.lang"); if (LANGS.some(l => l[0] === s)) return s; } catch(e){}
  const n = String(navigator.language || "en").slice(0, 2).toLowerCase(); return LANGS.some(l => l[0] === n) ? n : "en"; };
const LANG = pick(), I = { nl:0, fr:1, es:2 }[LANG];
window.JAVEDA_LANG = LANG;
document.documentElement.lang = LANG;

/* ---- the words: [English, Nederlands, Français, Español] ---- */
const S = [
  // the page
  ["The playable album", "Het speelbare album", "L'album jouable", "El álbum jugable"],
  ["Every song is a level. Finish one to open the next, then come back and beat your score.", "Elk nummer is een level. Speel er één uit om het volgende te openen, en kom terug om je score te verbeteren.", "Chaque morceau est un niveau. Termine-en un pour ouvrir le suivant, puis reviens battre ton score.", "Cada canción es un nivel. Termina uno para abrir el siguiente y vuelve para superar tu puntuación."],
  ["Levels", "Levels", "Niveaux", "Niveles"],
  ["Endless", "Eindeloos", "Infini", "Infinito"],
  ["Endless ∞", "Eindeloos ∞", "Infini ∞", "Infinito ∞"],
  ["Scoreboard", "Scorebord", "Classement", "Clasificación"],
  ["The music", "De muziek", "La musique", "La música"],
  ["The ultimate", "De ultieme", "L'ultime", "El definitivo"],
  ["Online", "Online", "En ligne", "Online"],
  ["Online 1v1", "Online 1v1", "1v1 en ligne", "1v1 online"],
  ["Points", "Punten", "Points", "Puntos"],
  ["Daily", "Dagelijks", "Du jour", "Diario"],
  ["Marathon", "Marathon", "Marathon", "Maratón"],
  ["Album marathon", "Albummarathon", "Marathon de l'album", "Maratón del álbum"],
  ["Lazy Jo × Zirka · no end", "Lazy Jo × Zirka · zonder einde", "Lazy Jo × Zirka · sans fin", "Lazy Jo × Zirka · sin fin"],
  ["No end. Harder and harder, a heart back now and then. How far can you go?", "Zonder einde. Steeds moeilijker, af en toe een hartje terug. Hoe ver kom jij?", "Sans fin. De plus en plus dur, un cœur de temps en temps. Jusqu'où iras-tu ?", "Sin fin. Cada vez más difícil, un corazón de vez en cuando. ¿Hasta dónde llegarás?"],
  ["Clear a part and its endless opens: that part with no end. Clear every part of a song and its remix opens too, all of them in turn. Play till the hearts run out. Only a new best earns points.", "Speel een deel uit en de eindeloze versie gaat open: dat deel zonder einde. Speel alle delen van een nummer uit en ook de remix gaat open, alle delen na elkaar. Speel tot je hartjes op zijn. Alleen een nieuw record levert punten op.", "Termine une partie et son mode infini s'ouvre : cette partie sans fin. Termine toutes les parties d'un morceau et son remix s'ouvre aussi, toutes à la suite. Joue jusqu'à ne plus avoir de cœurs. Seul un nouveau record rapporte des points.", "Supera una parte y se abre su modo infinito: esa parte sin fin. Supera todas las partes de una canción y se abre también su remix, todas seguidas. Juega hasta quedarte sin corazones. Solo un nuevo récord da puntos."],
  ["Clear every part of a song and its endless list opens: each part with no end, and the remix of them all. Play till the hearts run out. Only a new best earns points.", "Speel alle delen van een nummer uit en de eindeloze lijst gaat open: elk deel zonder einde, en de remix van allemaal. Speel tot je hartjes op zijn. Alleen een nieuw record levert punten op.", "Termine toutes les parties d'un morceau et sa liste infinie s'ouvre : chaque partie sans fin, et le remix de toutes. Joue jusqu'à ne plus avoir de cœurs. Seul un nouveau record rapporte des points.", "Supera todas las partes de una canción y se abre su lista infinita: cada parte sin fin y el remix de todas. Juega hasta quedarte sin corazones. Solo un nuevo récord da puntos."],
  ["Every part, one after the other, round and round. Every lap is harder, and a finished lap gives a heart back.", "Alle delen, na elkaar, rond en rond. Elke ronde is moeilijker, en een volle ronde geeft een hartje terug.", "Toutes les parties, l'une après l'autre, en boucle. Chaque tour est plus dur, et un tour fini rend un cœur.", "Todas las partes, una tras otra, una y otra vez. Cada vuelta es más difícil y una vuelta completa devuelve un corazón."],
  ["Remix", "Remix", "Remix", "Remix"],
  ["Remix ∞", "Remix ∞", "Remix ∞", "Remix ∞"],
  ["Remix ∞ · all parts", "Remix ∞ · alle delen", "Remix ∞ · toutes les parties", "Remix ∞ · todas las partes"],
  ["Remix ∞ 🔒", "Remix ∞ 🔒", "Remix ∞ 🔒", "Remix ∞ 🔒"],
  ["New", "Nieuw", "Nouveau", "Nuevo"],
  ["Cleared", "Uitgespeeld", "Terminé", "Superado"],
  ["✓ Cleared", "✓ Uitgespeeld", "✓ Terminé", "✓ Superado"],
  ["Not cleared yet", "Nog niet uitgespeeld", "Pas encore terminé", "Aún sin superar"],
  ["Play", "Speel", "Jouer", "Jugar"],
  ["Play ▶", "Speel ▶", "Jouer ▶", "Jugar ▶"],
  ["Play ∞", "Speel ∞", "Jouer ∞", "Jugar ∞"],
  ["Play now", "Nu spelen", "Jouer maintenant", "Jugar ahora"],
  ["Play HYPERDRIVE", "Speel HYPERDRIVE", "Jouer à HYPERDRIVE", "Jugar a HYPERDRIVE"],
  ["Replay", "Opnieuw", "Rejouer", "Repetir"],
  ["Run it again", "Nog een keer", "Encore une fois", "Otra vez"],
  ["Endless", "Eindeloos", "Infini", "Infinito"],
  ["Continue ▶", "Verder ▶", "Continuer ▶", "Continuar ▶"],
  ["songs cleared", "nummers uitgespeeld", "morceaux terminés", "canciones superadas"],
  ["Lazy Jo in his saucer or Zirka on his flying purple bike, over the roofs of District 9. Hold to rise; dodge the zappers, the missiles and the lasers; grab power-ups (magnet, shield, double coins, HYPERDRIVE) and ? boxes that transform you. Wolf Coins buy 24 skins, 9 trails and 8 gadgets. The album on the radio.", "Lazy Jo in zijn ufo of Zirka op zijn vliegende paarse motor, boven de daken van District 9. Ingedrukt houden om te stijgen; ontwijk de zappers, de raketten en de lasers; pak power-ups (magneet, schild, dubbele munten, HYPERDRIVE) en ?-kisten die je veranderen. Met Wolf Coins koop je 24 skins, 9 sporen en 8 gadgets. Het album op de radio.", "Lazy Jo dans sa soucoupe ou Zirka sur sa moto violette volante, au-dessus des toits de District 9. Maintiens pour monter ; esquive les zappeurs, les missiles et les lasers ; attrape des bonus (aimant, bouclier, pièces doubles, HYPERDRIVE) et des boîtes ? qui te transforment. Les Wolf Coins achètent 24 skins, 9 traînées et 8 gadgets. L'album à la radio.", "Lazy Jo en su platillo o Zirka en su moto morada voladora, sobre los tejados de District 9. Mantén para subir; esquiva los zappers, los misiles y los láseres; coge potenciadores (imán, escudo, monedas dobles, HYPERDRIVE) y cajas ? que te transforman. Con Wolf Coins compras 24 skins, 9 estelas y 8 gadgets. El álbum en la radio."],
  // the player, log-in, profile
  ["Guest", "Gast", "Invité", "Invitado"],
  ["Guest · not saved", "Gast · niet bewaard", "Invité · non sauvegardé", "Invitado · sin guardar"],
  ["Playing as a guest.", "Je speelt als gast.", "Tu joues en invité.", "Juegas como invitado."],
  ["Your progress stays on this phone only.", "Je voortgang blijft alleen op deze telefoon.", "Ta progression reste uniquement sur ce téléphone.", "Tu progreso se queda solo en este teléfono."],
  ["Log in", "Inloggen", "Se connecter", "Iniciar sesión"],
  ["Log out", "Uitloggen", "Se déconnecter", "Cerrar sesión"],
  ["Log in to save", "Log in om te bewaren", "Connecte-toi pour sauvegarder", "Inicia sesión para guardar"],
  ["Log in to play online", "Log in om online te spelen", "Connecte-toi pour jouer en ligne", "Inicia sesión para jugar online"],
  ["Log in to get your name on here.", "Log in om hier je naam te krijgen.", "Connecte-toi pour mettre ton nom ici.", "Inicia sesión para poner tu nombre aquí."],
  ["to save it, earn points and get on the scoreboard.", "om het te bewaren, punten te verdienen en op het scorebord te komen.", "pour la sauvegarder, gagner des points et entrer au classement.", "para guardarlo, ganar puntos y entrar en la clasificación."],
  ["Create an account", "Account maken", "Créer un compte", "Crear una cuenta"],
  ["Create account", "Account maken", "Créer le compte", "Crear cuenta"],
  ["Check your email to confirm, then come back and log in.", "Bevestig via de mail die je kreeg en log daarna hier in.", "Confirme via l'e-mail reçu, puis reviens te connecter.", "Confirma en el correo que te enviamos y vuelve a iniciar sesión."],
  ["New here?", "Nieuw hier?", "Nouveau ici ?", "¿Eres nuevo?"],
  ["Have an account?", "Heb je al een account?", "Tu as déjà un compte ?", "¿Ya tienes cuenta?"],
  ["Continue with Google", "Verder met Google", "Continuer avec Google", "Continuar con Google"],
  ["OR", "OF", "OU", "O"],
  ["Email", "E-mail", "E-mail", "Correo"],
  ["Password", "Wachtwoord", "Mot de passe", "Contraseña"],
  ["Name", "Naam", "Nom", "Nombre"],
  ["Your player", "Je speler", "Ton joueur", "Tu jugador"],
  ["Profile picture", "Profielfoto", "Photo de profil", "Foto de perfil"],
  ["Save", "Bewaren", "Enregistrer", "Guardar"],
  ["Saved", "Bewaard", "Enregistré", "Guardado"],
  ["Not now", "Niet nu", "Pas maintenant", "Ahora no"],
  ["Creator", "Maker", "Créateur", "Creador"],
  ["Credits", "Credits", "Crédits", "Créditos"],
  ["Pick a name and a picture to start.", "Kies een naam en een foto om te beginnen.", "Choisis un nom et une image pour commencer.", "Elige un nombre y una imagen para empezar."],
  ["The first four pictures are free.", "De eerste vier foto's zijn gratis.", "Les quatre premières images sont gratuites.", "Las cuatro primeras imágenes son gratis."],
  ["to earn points by playing and unlock the rest.", "om punten te verdienen door te spelen en de rest te ontgrendelen.", "pour gagner des points en jouant et débloquer le reste.", "para ganar puntos jugando y desbloquear el resto."],
  ["Your Lightning Wolves account: the same one as the Wolf Hub. Your guest progress comes with you.", "Je Lightning Wolves-account: dezelfde als voor de Wolf Hub. Je voortgang als gast neem je mee.", "Ton compte Lightning Wolves : le même que pour le Wolf Hub. Ta progression d'invité te suit.", "Tu cuenta de Lightning Wolves: la misma que la del Wolf Hub. Tu progreso de invitado viene contigo."],
  ["3-16 letters or numbers", "3-16 letters of cijfers", "3 à 16 lettres ou chiffres", "3-16 letras o números"],
  ["Saved on this phone. Log in to keep it everywhere.", "Bewaard op deze telefoon. Log in om het overal te hebben.", "Enregistré sur ce téléphone. Connecte-toi pour l'avoir partout.", "Guardado en este teléfono. Inicia sesión para tenerlo en todas partes."],
  ["Log-in is offline right now. Your progress is saved on this phone.", "Inloggen werkt nu even niet. Je voortgang is bewaard op deze telefoon.", "La connexion est indisponible pour le moment. Ta progression est enregistrée sur ce téléphone.", "El inicio de sesión no funciona ahora mismo. Tu progreso está guardado en este teléfono."],
  ["Google log-in isn't switched on yet. Use email.", "Inloggen met Google staat nog niet aan. Gebruik je e-mail.", "La connexion Google n'est pas encore activée. Utilise ton e-mail.", "El inicio con Google aún no está activado. Usa tu correo."],
  ["Your guest progress is saved", "Je voortgang als gast is bewaard", "Ta progression d'invité est enregistrée", "Tu progreso de invitado está guardado"],
  ["Log in to play online - the result goes on your account.", "Log in om online te spelen - de uitslag komt op je account.", "Connecte-toi pour jouer en ligne - le résultat va sur ton compte.", "Inicia sesión para jugar online - el resultado va a tu cuenta."],
  // points
  ["You have", "Je hebt", "Tu as", "Tienes"],
  ["You earn them by playing: up to", "Je verdient ze door te spelen: tot", "Tu les gagnes en jouant : jusqu'à", "Los ganas jugando: hasta"],
  ["a run for your score,", "per run voor je score,", "par partie pour ton score,", "por partida por tu puntuación,"],
  ["for every clear and a big bonus the first time you clear a level. Tap a locked picture to unlock it.", "voor elke keer uitspelen en een grote bonus de eerste keer dat je een level uitspeelt. Tik op een vergrendelde foto om hem te ontgrendelen.", "pour chaque niveau terminé et un gros bonus la première fois que tu termines un niveau. Touche une image verrouillée pour la débloquer.", "por cada nivel superado y un gran bonus la primera vez que superas un nivel. Toca una imagen bloqueada para desbloquearla."],
  ["Points are earned by playing, never by streaming.", "Punten verdien je door te spelen, nooit door te streamen.", "Les points se gagnent en jouant, jamais en streamant.", "Los puntos se ganan jugando, nunca escuchando en streaming."],
  [". Points are earned by playing, never by streaming.", ". Punten verdien je door te spelen, nooit door te streamen.", ". Les points se gagnent en jouant, jamais en streamant.", ". Los puntos se ganan jugando, nunca escuchando en streaming."],
  ["first clear!", "eerste keer uitgespeeld!", "première victoire !", "¡primera vez superado!"],
  ["New best!", "Nieuw record!", "Nouveau record !", "¡Nuevo récord!"],
  ["to put it on the scoreboard.", "om het op het scorebord te zetten.", "pour le mettre au classement.", "para ponerlo en la clasificación."],
  ["to save it everywhere.", "om het overal te bewaren.", "pour le sauvegarder partout.", "para guardarlo en todas partes."],
  ["beat it for points", "verbeter het voor punten", "bats-le pour des points", "supéralo para ganar puntos"],
  ["Your best is still", "Je record is nog steeds", "Ton record est toujours", "Tu récord sigue siendo"],
  ["That run didn't save:", "Die run is niet bewaard:", "Cette partie n'a pas été enregistrée :", "Esa partida no se guardó:"],
  ["it never started", "hij is nooit begonnen", "elle n'a jamais commencé", "nunca empezó"],
  ["You left the run.", "Je hebt de run verlaten.", "Tu as quitté la partie.", "Has dejado la partida."],
  // scoreboard
  ["Which scoreboard", "Welk scorebord", "Quel classement", "Qué clasificación"],
  ["Level", "Level", "Niveau", "Nivel"],
  ["Part", "Deel", "Partie", "Parte"],
  ["Nobody on this board yet. Be the first.", "Nog niemand op dit bord. Wees de eerste.", "Personne sur ce classement pour l'instant. Sois le premier.", "Aún no hay nadie en esta tabla. Sé el primero."],
  ["Nobody on this board yet.", "Nog niemand op dit bord.", "Personne sur ce classement pour l'instant.", "Aún no hay nadie en esta tabla."],
  ["Could not load the scoreboard. Try again in a bit.", "Het scorebord kon niet laden. Probeer het zo nog eens.", "Impossible de charger le classement. Réessaie dans un instant.", "No se pudo cargar la clasificación. Inténtalo de nuevo en un momento."],
  ["No matches yet", "Nog geen wedstrijden", "Pas encore de matchs", "Aún no hay partidas"],
  ["No 1v1 wins yet.", "Nog geen 1v1-overwinningen.", "Pas encore de victoire en 1v1.", "Aún no hay victorias 1v1."],
  ["Nobody has played today's challenge yet.", "Nog niemand heeft de uitdaging van vandaag gespeeld.", "Personne n'a encore joué le défi du jour.", "Nadie ha jugado aún el reto de hoy."],
  ["Today's challenge", "De uitdaging van vandaag", "Le défi du jour", "El reto de hoy"],
  ["The same song for everyone today, with its own scoreboard - empty again tomorrow.", "Vandaag hetzelfde nummer voor iedereen, met een eigen scorebord - morgen weer leeg.", "Le même morceau pour tout le monde aujourd'hui, avec son propre classement - vide à nouveau demain.", "La misma canción para todos hoy, con su propia clasificación - vacía otra vez mañana."],
  ["Your best today #", "Je beste vandaag #", "Ton record du jour #", "Tu mejor marca de hoy #"],
  ["Board", "Bord", "Classement", "Clasificación"],
  ["Nobody has run the album marathon yet.", "Nog niemand heeft de albummarathon gelopen.", "Personne n'a encore couru le marathon de l'album.", "Nadie ha corrido aún el maratón del álbum."],
  ["Log in for the board", "Log in voor het bord", "Connecte-toi pour le classement", "Inicia sesión para la tabla"],
  ["Not played yet today", "Vandaag nog niet gespeeld", "Pas encore joué aujourd'hui", "Aún no has jugado hoy"],
  // online
  ["Quick match against a real player.", "Snelle match tegen een echte speler.", "Match rapide contre un vrai joueur.", "Partida rápida contra un jugador real."],
  ["Quick match against real players.", "Snelle match tegen echte spelers.", "Match rapide contre de vrais joueurs.", "Partida rápida contra jugadores reales."],
  ["The first online one", "De eerste online", "Le premier en ligne", "El primero online"],
  ["Memory, head to head", "Geheugen, man tegen man", "Mémoire, face à face", "Memoria, cara a cara"],
  ["Two card games", "Twee kaartspellen", "Deux jeux de cartes", "Dos juegos de cartas"],
  ["On the roofs at sunset", "Op de daken bij zonsondergang", "Sur les toits au coucher du soleil", "En los tejados al atardecer"],
  ["the same song and the same shots at the same time, side by side - the highest score wins.", "hetzelfde nummer en dezelfde schoten tegelijk, naast elkaar - de hoogste score wint.", "le même morceau et les mêmes tirs en même temps, côte à côte - le meilleur score gagne.", "la misma canción y los mismos tiros a la vez, uno al lado del otro - gana la puntuación más alta."],
  ["take turns - make a shot and they have to make it too, or it's a letter. Spell HORSE and you're out. A win is +25 points.", "om de beurt - maak een schot en de ander moet het ook maken, anders is het een letter. Spel je HORSE, dan lig je eruit. Winnen is +25 punten.", "chacun son tour - réussis un tir et l'autre doit le réussir aussi, sinon c'est une lettre. HORSE en entier et tu es éliminé. Une victoire, c'est +25 points.", "por turnos - mete un tiro y el otro tiene que meterlo también, o es una letra. Si completas HORSE, quedas fuera. Ganar son +25 puntos."],
  ["one bed of cards between you - take turns turning two, a pair and you go again, the most pairs wins.", "één bed vol kaarten tussen jullie - om de beurt twee omdraaien, een paar en je mag nog eens, de meeste paren wint.", "un lit de cartes entre vous - chacun retourne deux cartes à son tour, une paire et tu rejoues, le plus de paires gagne.", "una cama de cartas entre los dos - por turnos dais la vuelta a dos, una pareja y repites, gana quien tenga más parejas."],
  ["the same cards for both at the same time - the quicker snap takes the pair. A win is +25 points.", "dezelfde kaarten voor allebei tegelijk - wie het snelst snapt, krijgt het paar. Winnen is +25 punten.", "les mêmes cartes pour les deux en même temps - le plus rapide à crier SNAP prend la paire. Une victoire, c'est +25 points.", "las mismas cartas para los dos a la vez - el SNAP más rápido se lleva la pareja. Ganar son +25 puntos."],
  ["for 2, 3 or 4: the same nine holes at the same time, the others as ghost balls - the fewest strokes takes the hole, the most holes wins.", "voor 2, 3 of 4: dezelfde negen holes tegelijk, de anderen als spookballen - de minste slagen wint de hole, de meeste holes wint.", "à 2, 3 ou 4 : les mêmes neuf trous en même temps, les autres en balles fantômes - le moins de coups gagne le trou, le plus de trous gagne.", "para 2, 3 o 4: los mismos nueve hoyos a la vez, los demás como bolas fantasma - menos golpes gana el hoyo, más hoyos gana."],
  ["one air hockey table, first to 3 rounds. A win is +25 points; with 3 or 4, 2nd place earns some too.", "één airhockeytafel, wie het eerst 3 rondes wint. Winnen is +25 punten; met 3 of 4 verdient de tweede plaats ook wat.", "une table de air hockey, le premier à 3 manches. Une victoire, c'est +25 points ; à 3 ou 4, la 2e place rapporte aussi.", "una mesa de hockey de aire, el primero en ganar 3 rondas. Ganar son +25 puntos; con 3 o 4, el 2.º puesto también gana algo."],
  ["Quick match against a real player, one pattern of lights between you. Play it back, add a light of your own, pass it on - and remember every one they add. Get one wrong and it's a Z; three Z's and you fell asleep. A win is +25 points.", "Snelle match tegen een echte speler, één patroon van lichtjes tussen jullie. Speel het na, voeg er zelf een lichtje aan toe, geef het door - en onthoud elk lichtje dat de ander toevoegt. Eén fout en het is een Z; drie Z's en je bent in slaap gevallen. Winnen is +25 punten.", "Match rapide contre un vrai joueur, une suite de lumières entre vous. Rejoue-la, ajoute une lumière, passe-la - et retiens chaque lumière ajoutée. Une erreur et c'est un Z ; trois Z et tu t'es endormi. Une victoire, c'est +25 points.", "Partida rápida contra un jugador real, una secuencia de luces entre los dos. Repítela, añade una luz tuya, pásala - y recuerda cada una que añada el otro. Un fallo y es una Z; tres Z y te has dormido. Ganar son +25 puntos."],
  ["Live 1v1", "Live 1v1", "Live 1v1", "Live 1v1"],
  ["Golf 1v1", "Golf 1v1", "Golf 1v1", "Golf 1v1"],
  ["Hockey 1v1", "Hockey 1v1", "Hockey 1v1", "Hockey 1v1"],
  ["Love Cards 1v1", "Love Cards 1v1", "Love Cards 1v1", "Love Cards 1v1"],
  ["Snap 1v1", "Snap 1v1", "Snap 1v1", "Snap 1v1"],
  ["Pass It On 1v1", "Pass It On 1v1", "Pass It On 1v1", "Pass It On 1v1"],
  ["ONLINE", "ONLINE", "EN LIGNE", "ONLINE"],
  ["Which game", "Welk spel", "Quel jeu", "Qué juego"],
  ["Match saved - it counts once the other player's result is in.", "Wedstrijd bewaard - hij telt zodra de uitslag van de ander binnen is.", "Match enregistré - il compte dès que le résultat de l'autre joueur arrive.", "Partida guardada - cuenta cuando llegue el resultado del otro jugador."],
  ["Game saved - it counts once everyone's result is in.", "Spel bewaard - het telt zodra ieders uitslag binnen is.", "Partie enregistrée - elle compte dès que tous les résultats sont arrivés.", "Partida guardada - cuenta cuando lleguen los resultados de todos."],
  ["The two results didn't match, so this one doesn't count.", "De twee uitslagen kwamen niet overeen, dus deze telt niet.", "Les deux résultats ne correspondent pas, celui-ci ne compte donc pas.", "Los dos resultados no coinciden, así que esta no cuenta."],
  ["The results didn't all match, so this one doesn't count.", "Niet alle uitslagen kwamen overeen, dus deze telt niet.", "Les résultats ne correspondent pas tous, celle-ci ne compte donc pas.", "No todos los resultados coinciden, así que esta no cuenta."],
  ["1v1 win!", "1v1 gewonnen!", "Victoire en 1v1 !", "¡Victoria 1v1!"],
  ["1v1 loss.", "1v1 verloren.", "Défaite en 1v1.", "Derrota 1v1."],
  ["A 1v1 draw.", "Gelijkspel in 1v1.", "Égalité en 1v1.", "Empate 1v1."],
  ["On the board.", "Op het bord.", "Au classement.", "En la tabla."],
  ["On the board - get them next time.", "Op het bord - volgende keer pak je ze.", "Au classement - tu les auras la prochaine fois.", "En la tabla - la próxima vez los pillas."],
  ["That match didn't save:", "Die wedstrijd is niet bewaard:", "Ce match n'a pas été enregistré :", "Esa partida no se guardó:"],
  ["1st place!", "1e plaats!", "1re place !", "¡1.er puesto!"],
  // invite a friend
  ["Invite a friend", "Nodig een vriend uit", "Invite un ami", "Invita a un amigo"],
  ["💌 Invite a friend", "💌 Nodig een vriend uit", "💌 Invite un ami", "💌 Invita a un amigo"],
  ["A private room just for you and the people you send this link to. No waiting for strangers: they open it, log in, and you play.", "Een privékamer alleen voor jou en de mensen naar wie je deze link stuurt. Niet wachten op vreemden: zij openen hem, loggen in en jullie spelen.", "Une salle privée rien que pour toi et les personnes à qui tu envoies ce lien. Pas d'attente d'inconnus : ils l'ouvrent, se connectent, et vous jouez.", "Una sala privada solo para ti y las personas a las que envíes este enlace. Sin esperar a desconocidos: lo abren, inician sesión y jugáis."],
  ["Copy the link", "Kopieer de link", "Copier le lien", "Copiar el enlace"],
  ["Copy", "Kopiëren", "Copier", "Copiar"],
  ["Open the room", "Open de kamer", "Ouvrir la salle", "Abrir la sala"],
  ["Invite link", "Uitnodigingslink", "Lien d'invitation", "Enlace de invitación"],
  ["You're invited", "Je bent uitgenodigd", "Tu es invité", "Estás invitado"],
  ["Link copied", "Link gekopieerd", "Lien copié", "Enlace copiado"],
  ["Link copied - send it to your friend", "Link gekopieerd - stuur hem naar je vriend", "Lien copié - envoie-le à ton ami", "Enlace copiado - envíaselo a tu amigo"],
  ["Log in first (free) - the result goes on your account.", "Log eerst in (gratis) - de uitslag komt op je account.", "Connecte-toi d'abord (gratuit) - le résultat va sur ton compte.", "Inicia sesión primero (gratis) - el resultado va a tu cuenta."],
  ["nobody yet", "nog niemand", "personne pour l'instant", "nadie todavía"],
  // share
  ["Share", "Delen", "Partager", "Compartir"],
  ["📸 Share", "📸 Delen", "📸 Partager", "📸 Compartir"],
  ["Share it", "Deel het", "Partage-le", "Compártelo"],
  ["Share…", "Delen…", "Partager…", "Compartir…"],
  ["Save picture", "Foto bewaren", "Enregistrer l'image", "Guardar imagen"],
  ["Share the link", "Deel de link", "Partager le lien", "Compartir el enlace"],
  ["Create a free account", "Maak een gratis account", "Crée un compte gratuit", "Crea una cuenta gratis"],
  ["Create a free account to get your name on here.", "Maak een gratis account om hier met je naam te staan.", "Crée un compte gratuit pour voir ton nom ici.", "Crea una cuenta gratis para que salga tu nombre aquí."],
  ["Show the top 5", "Toon de top 5", "Voir le top 5", "Ver el top 5"],
  ["Connecting…", "Verbinden…", "Connexion…", "Conectando…"],
  ["Looking…", "Zoeken…", "Recherche…", "Buscando…"],
  ["Join the room", "Kom in de kamer", "Rejoindre la salle", "Entrar en la sala"],
  ["Looking for a player…", "Op zoek naar een speler…", "On cherche un joueur…", "Buscando un jugador…"],
  ["Looking for players…", "Op zoek naar spelers…", "On cherche des joueurs…", "Buscando jugadores…"],
  ["Waiting for your friend… they join as soon as they open your link.", "We wachten op je vriend… die komt erbij zodra die je link opent.", "On attend ton ami… il arrive dès qu'il ouvre ton lien.", "Esperando a tu amigo… entra en cuanto abra tu enlace."],
  ["Looking for a player… nobody else is looking right now. Stay here - the next one in plays you.", "Op zoek naar een speler… er zoekt nu verder niemand. Blijf hier - de volgende die komt speelt tegen jou.", "On cherche un joueur… personne d'autre ne cherche pour l'instant. Reste ici - le prochain qui arrive joue contre toi.", "Buscando un jugador… nadie más está buscando ahora. Quédate aquí: el siguiente que llegue juega contra ti."],
  ["Make your player on the JAVEDA page first (a name and a picture).", "Maak eerst je speler op de JAVEDA-pagina (een naam en een foto).", "Crée d'abord ton joueur sur la page JAVEDA (un nom et une image).", "Crea primero tu jugador en la página de JAVEDA (un nombre y una imagen)."],
  ["Privacy", "Privacy", "Confidentialité", "Privacidad"],
  ["Report a problem", "Meld een probleem", "Signaler un problème", "Informar de un problema"],
  ["How JAVEDA keeps your data", "Hoe JAVEDA met je gegevens omgaat", "Comment JAVEDA garde tes données", "Cómo guarda JAVEDA tus datos"],
  ["Something broken, a level that won't work, or a question about your data? Tell Lazy Jo.", "Iets kapot, een level dat niet werkt, of een vraag over je gegevens? Laat het Lazy Jo weten.", "Quelque chose de cassé, un niveau qui ne marche pas, ou une question sur tes données ? Dis-le à Lazy Jo.", "¿Algo roto, un nivel que no funciona o una pregunta sobre tus datos? Díselo a Lazy Jo."],
  ["What is it about?", "Waar gaat het over?", "C'est à propos de quoi ?", "¿De qué se trata?"],
  ["A level", "Een level", "Un niveau", "Un nivel"],
  ["My account or points", "Mijn account of punten", "Mon compte ou mes points", "Mi cuenta o mis puntos"],
  ["My data (privacy)", "Mijn gegevens (privacy)", "Mes données (confidentialité)", "Mis datos (privacidad)"],
  ["Something else", "Iets anders", "Autre chose", "Otra cosa"],
  ["Which level?", "Welk level?", "Quel niveau ?", "¿Qué nivel?"],
  ["What happened?", "Wat gebeurde er?", "Que s'est-il passé ?", "¿Qué ha pasado?"],
  ["Your email (only if you want an answer)", "Je e-mail (alleen als je een antwoord wilt)", "Ton e-mail (seulement si tu veux une réponse)", "Tu email (solo si quieres respuesta)"],
  ["It goes with the kind of phone and browser you use, so the problem can be found - nothing else.", "Het gaat mee met het soort telefoon en browser dat je gebruikt, zodat het probleem gevonden kan worden - verder niets.", "On envoie aussi le type de téléphone et de navigateur que tu utilises, pour trouver le problème - rien d'autre.", "Se envía también el tipo de móvil y navegador que usas, para poder encontrar el problema; nada más."],
  ["Send", "Versturen", "Envoyer", "Enviar"],
  ["That didn't send. Try again in a bit.", "Dat is niet verstuurd. Probeer het zo nog eens.", "Ça n'est pas parti. Réessaie dans un moment.", "No se ha enviado. Inténtalo de nuevo en un rato."],
  ["Write what happened first.", "Schrijf eerst wat er gebeurde.", "Écris d'abord ce qui s'est passé.", "Primero escribe qué ha pasado."],
  ["That email doesn't look right (or leave it empty).", "Dat e-mailadres klopt niet (of laat het leeg).", "Cet e-mail n'a pas l'air correct (ou laisse-le vide).", "Ese email no parece correcto (o déjalo vacío)."],
  ["Thanks - it's on its way to Lazy Jo.", "Bedankt - het is onderweg naar Lazy Jo.", "Merci - c'est en route vers Lazy Jo.", "Gracias - va de camino a Lazy Jo."],
  ["You're offline: it goes as soon as you're back online.", "Je bent offline: het gaat zodra je weer online bent.", "Tu es hors ligne : ça part dès que tu es de nouveau en ligne.", "Estás sin conexión: se enviará en cuanto vuelvas a estar online."],
  ["Get the app", "Download de app", "Télécharger l'app", "Descarga la app"],
  ["On your home screen, and it plays offline.", "Op je beginscherm, en hij werkt offline.", "Sur ton écran d'accueil, et elle marche hors ligne.", "En tu pantalla de inicio, y funciona sin conexión."],
  ["Put JAVEDA on your phone", "Zet JAVEDA op je telefoon", "Mets JAVEDA sur ton téléphone", "Pon JAVEDA en tu móvil"],
  ["Save the songs for offline", "Bewaar de nummers voor offline", "Enregistrer les morceaux hors ligne", "Guardar las canciones sin conexión"],
  ["# of # songs saved on this phone.", "# van de # nummers bewaard op deze telefoon.", "# morceaux sur # enregistrés sur ce téléphone.", "# de # canciones guardadas en este móvil."],
  ["Then every level plays without internet.", "Dan werkt elk level zonder internet.", "Alors chaque niveau marche sans internet.", "Así cada nivel funciona sin internet."],
  ["Saving the songs…", "De nummers worden bewaard…", "Enregistrement des morceaux…", "Guardando las canciones…"],
  ["Song # of #…", "Nummer # van #…", "Morceau # sur #…", "Canción # de #…"],
  ["# of # songs saved. Try again later for the rest.", "# van de # nummers bewaard. Probeer het later nog eens voor de rest.", "# morceaux sur # enregistrés. Réessaie plus tard pour le reste.", "# de # canciones guardadas. Vuelve a intentarlo más tarde para el resto."],
  ["All the songs are saved. JAVEDA plays offline now.", "Alle nummers zijn bewaard. JAVEDA werkt nu offline.", "Tous les morceaux sont enregistrés. JAVEDA marche hors ligne maintenant.", "Todas las canciones están guardadas. JAVEDA ya funciona sin conexión."],
  ["Connect to the internet to save the songs.", "Maak verbinding met internet om de nummers te bewaren.", "Connecte-toi à internet pour enregistrer les morceaux.", "Conéctate a internet para guardar las canciones."],
  ["JAVEDA is on your home screen. Open it from there.", "JAVEDA staat op je beginscherm. Open hem vanaf daar.", "JAVEDA est sur ton écran d'accueil. Ouvre-la depuis là.", "JAVEDA está en tu pantalla de inicio. Ábrela desde ahí."],
  ["Song", "Nummer", "Morceau", "Canción"],
  ["Game sounds", "Spelgeluiden", "Sons du jeu", "Sonidos del juego"],
  ["Song on", "Nummer aan", "Morceau activé", "Canción activada"],
  ["Song off", "Nummer uit", "Morceau coupé", "Canción silenciada"],
  ["Game sounds on", "Spelgeluiden aan", "Sons du jeu activés", "Sonidos del juego activados"],
  ["Game sounds off", "Spelgeluiden uit", "Sons du jeu coupés", "Sonidos del juego silenciados"],
  ["Email me JAVEDA news: new levels and new songs. You can switch it off in your profile any time.", "Mail me JAVEDA-nieuws: nieuwe levels en nieuwe nummers. Je zet het in je profiel altijd weer uit.", "Envoie-moi les nouvelles de JAVEDA par e-mail : nouveaux niveaux et nouveaux morceaux. Tu peux les couper à tout moment dans ton profil.", "Envíame noticias de JAVEDA por correo: niveles nuevos y canciones nuevas. Puedes desactivarlo en tu perfil cuando quieras."],
  ["Email me JAVEDA news: new levels and new songs.", "Mail me JAVEDA-nieuws: nieuwe levels en nieuwe nummers.", "Envoie-moi les nouvelles de JAVEDA par e-mail : nouveaux niveaux et nouveaux morceaux.", "Envíame noticias de JAVEDA por correo: niveles nuevos y canciones nuevas."],
  ["You'll get JAVEDA news by email.", "Je krijgt JAVEDA-nieuws per mail.", "Tu recevras les nouvelles de JAVEDA par e-mail.", "Recibirás noticias de JAVEDA por correo."],
  // notifications
  ["Notifications", "Meldingen", "Notifications", "Notificaciones"],
  ["Today's challenge is up (every morning at #)", "De uitdaging van vandaag staat klaar (elke ochtend om # uur)", "Le défi du jour est là (chaque matin à # h)", "El reto de hoy ya está aquí (cada mañana a las #)"],
  ["Someone beats one of your scores", "Iemand verslaat een van je scores", "Quelqu'un bat un de tes scores", "Alguien supera una de tus puntuaciones"],
  ["log in for this one", "log in voor deze", "connecte-toi pour celle-ci", "inicia sesión para esta"],
  ["On iPhone and iPad, notifications come with the app: tap Get the app first.", "Op iPhone en iPad krijg je meldingen in de app: tik eerst op Download de app.", "Sur iPhone et iPad, les notifications viennent avec l'app : touche d'abord Télécharger l'app.", "En iPhone y iPad, las notificaciones llegan con la app: toca primero Descarga la app."],
  ["Notifications are blocked for JAVEDA in this phone's settings.", "Meldingen voor JAVEDA staan uit in de instellingen van deze telefoon.", "Les notifications de JAVEDA sont bloquées dans les réglages de ce téléphone.", "Las notificaciones de JAVEDA están bloqueadas en los ajustes de este teléfono."],
  ["Tell me when the next challenge is up", "Laat me weten wanneer de volgende uitdaging klaarstaat", "Préviens-moi quand le prochain défi est là", "Avísame cuando esté el próximo reto"],
  ["We'll tell you when the next challenge is up.", "We laten je weten wanneer de volgende uitdaging klaarstaat.", "On te prévient quand le prochain défi est là.", "Te avisaremos cuando esté el próximo reto."],
  ["No notifications, then.", "Dan geen meldingen.", "Pas de notifications, alors.", "Entonces, sin notificaciones."],
  ["Notifications didn't turn on here.", "De meldingen gingen hier niet aan.", "Les notifications ne se sont pas activées ici.", "Las notificaciones no se han activado aquí."],
  ["Notifications are on.", "Meldingen staan aan.", "Les notifications sont activées.", "Las notificaciones están activadas."],
  ["Notifications are off.", "Meldingen staan uit.", "Les notifications sont désactivées.", "Las notificaciones están desactivadas."],
  ["Notifications are on. You can turn them off in your player.", "Meldingen staan aan. Je kunt ze uitzetten bij je speler.", "Les notifications sont activées. Tu peux les désactiver dans ton joueur.", "Las notificaciones están activadas. Puedes desactivarlas en tu jugador."],
  ["Notifications are on. Log in and you'll also hear when someone beats your score.", "Meldingen staan aan. Log in en je hoort ook wanneer iemand je score verslaat.", "Les notifications sont activées. Connecte-toi et tu sauras aussi quand quelqu'un bat ton score.", "Las notificaciones están activadas. Inicia sesión y también sabrás cuándo alguien supera tu puntuación."],
  ["No more JAVEDA news emails.", "Geen JAVEDA-nieuwsmails meer.", "Plus d'e-mails de nouvelles JAVEDA.", "No más correos de noticias de JAVEDA."],
  ["Log in first", "Log eerst in", "Connecte-toi d'abord", "Inicia sesión primero"],
  ["Make your player first", "Maak eerst je speler aan", "Crée d'abord ton joueur", "Crea primero tu jugador"],
  ["Delete my account", "Mijn account verwijderen", "Supprimer mon compte", "Eliminar mi cuenta"],
  ["Delete your account?", "Je account verwijderen?", "Supprimer ton compte ?", "¿Eliminar tu cuenta?"],
  ["This can't be undone. Gone for good:", "Dit kan niet ongedaan worden. Dit verdwijnt voorgoed:", "C'est définitif. Tout ceci disparaît pour de bon :", "No se puede deshacer. Esto desaparece para siempre:"],
  ["your player name and profile picture", "je spelersnaam en profielfoto", "ton nom de joueur et ta photo de profil", "tu nombre de jugador y tu foto de perfil"],
  ["your points, the pictures you unlocked and every level you cleared", "je punten, de foto's die je vrijspeelde en elk level dat je haalde", "tes points, les photos débloquées et chaque niveau réussi", "tus puntos, las fotos que desbloqueaste y cada nivel que superaste"],
  ["your scores on the leaderboards and your 1v1 record", "je scores in de ranglijsten en je 1v1-resultaten", "tes scores dans les classements et ton bilan en 1v1", "tus puntuaciones en las clasificaciones y tu historial 1v1"],
  ["Your JAVEDA Pass goes too.", "Je JAVEDA Pass verdwijnt ook.", "Ton JAVEDA Pass disparaît aussi.", "Tu JAVEDA Pass también desaparece."],
  ["If you also use this login for the Lightning Wolves Studio or the Wolf Hub, the login itself stays and only your JAVEDA player goes.", "Gebruik je deze login ook voor de Lightning Wolves Studio of de Wolf Hub, dan blijft de login zelf bestaan en verdwijnt alleen je JAVEDA-speler.", "Si tu utilises aussi ce compte pour le Lightning Wolves Studio ou le Wolf Hub, le compte reste et seul ton joueur JAVEDA disparaît.", "Si también usas esta cuenta para Lightning Wolves Studio o el Wolf Hub, la cuenta se queda y solo se va tu jugador de JAVEDA."],
  ["Keep my account", "Mijn account houden", "Garder mon compte", "Conservar mi cuenta"],
  ["Yes, delete it", "Ja, verwijderen", "Oui, supprimer", "Sí, eliminarla"],
  ["Deleting your account needs the internet.", "Je account verwijderen kan alleen met internet.", "Supprimer ton compte nécessite internet.", "Para eliminar tu cuenta necesitas internet."],
  ["No internet. Try again when you're online.", "Geen internet. Probeer het opnieuw als je online bent.", "Pas d'internet. Réessaie quand tu es en ligne.", "Sin internet. Inténtalo de nuevo cuando tengas conexión."],
  ["Your account is deleted.", "Je account is verwijderd.", "Ton compte est supprimé.", "Tu cuenta se ha eliminado."],
  ["Your JAVEDA player is deleted. Your Lightning Wolves login stays, because you also use it for the Studio or the Wolf Hub.", "Je JAVEDA-speler is verwijderd. Je Lightning Wolves-login blijft, omdat je die ook voor de Studio of de Wolf Hub gebruikt.", "Ton joueur JAVEDA est supprimé. Ton compte Lightning Wolves reste, car tu l'utilises aussi pour le Studio ou le Wolf Hub.", "Tu jugador de JAVEDA se ha eliminado. Tu cuenta de Lightning Wolves se queda, porque también la usas para el Studio o el Wolf Hub."],
  ["Online games need the internet.", "Online spellen hebben internet nodig.", "Les jeux en ligne ont besoin d'internet.", "Los juegos online necesitan internet."],
  ["You're offline: this run is saved on this phone. It goes to your account when you're back online.", "Je bent offline: deze run is bewaard op deze telefoon. Hij gaat naar je account zodra je weer online bent.", "Tu es hors ligne : cette partie est sauvegardée sur ce téléphone. Elle ira sur ton compte dès que tu seras de nouveau en ligne.", "Estás sin conexión: esta partida se guarda en este móvil. Irá a tu cuenta en cuanto vuelvas a estar online."],
  ["1 run you played offline is on your account now", "1 run die je offline speelde staat nu op je account", "1 partie jouée hors ligne est maintenant sur ton compte", "1 partida que jugaste sin conexión ya está en tu cuenta"],
  ["# runs you played offline are on your account now", "# runs die je offline speelde staan nu op je account", "# parties jouées hors ligne sont maintenant sur ton compte", "# partidas que jugaste sin conexión ya están en tu cuenta"],
  ["You're offline: endless scores only count with internet.", "Je bent offline: eindeloze scores tellen alleen met internet.", "Tu es hors ligne : les scores infinis ne comptent qu'avec internet.", "Estás sin conexión: las puntuaciones infinitas solo cuentan con internet."],
  ["You're offline: the daily challenge only counts with internet.", "Je bent offline: de dagelijkse uitdaging telt alleen met internet.", "Tu es hors ligne : le défi du jour ne compte qu'avec internet.", "Estás sin conexión: el reto diario solo cuenta con internet."],
  ["You're offline. Log-in needs the internet the first time.", "Je bent offline. Inloggen heeft de eerste keer internet nodig.", "Tu es hors ligne. La connexion a besoin d'internet la première fois.", "Estás sin conexión. Iniciar sesión necesita internet la primera vez."],
  ["This song isn't saved on this phone yet. Play it once with internet, or save all the songs in the app.", "Dit nummer is nog niet bewaard op deze telefoon. Speel het één keer met internet, of bewaar alle nummers in de app.", "Ce morceau n'est pas encore enregistré sur ce téléphone. Joue-le une fois avec internet, ou enregistre tous les morceaux dans l'app.", "Esta canción aún no está guardada en este móvil. Juégala una vez con internet, o guarda todas las canciones en la app."],
  ["Want your name up here?", "Wil je hier met je naam staan?", "Tu veux voir ton nom ici ?", "¿Quieres ver tu nombre aquí?"],
  ["Playing as a guest, your progress stays on this phone only.", "Als gast blijft je voortgang alleen op deze telefoon.", "En invité, ta progression reste uniquement sur ce téléphone.", "Como invitado, tu progreso se queda solo en este móvil."],
  ["The scoreboard is offline right now. Your runs still count on this phone.", "Het scorebord is nu offline. Je runs tellen nog steeds op deze telefoon.", "Le classement est hors ligne pour l'instant. Tes parties comptent toujours sur ce téléphone.", "La clasificación está sin conexión ahora mismo. Tus partidas siguen contando en este móvil."],
  ["The scoreboard is for players with an account. It's free: your scores go on the board, you earn points, and your progress is saved on every phone and computer.", "Het scorebord is voor spelers met een account. Het is gratis: je scores komen op het bord, je verdient punten en je voortgang wordt bewaard op elke telefoon en computer.", "Le classement est pour les joueurs avec un compte. C'est gratuit : tes scores vont au classement, tu gagnes des points et ta progression est sauvegardée sur chaque téléphone et ordinateur.", "La clasificación es para jugadores con cuenta. Es gratis: tus puntuaciones entran en la tabla, ganas puntos y tu progreso se guarda en cada móvil y ordenador."],
  ["Show the top #", "Toon de top #", "Voir le top #", "Ver el top #"],
  ["I finished JAVEDA - all # songs of Lazy Jo's playable album.", "Ik heb JAVEDA uitgespeeld - alle # nummers van het speelbare album van Lazy Jo.", "J'ai fini JAVEDA - les # morceaux de l'album jouable de Lazy Jo.", "He terminado JAVEDA - las # canciones del álbum jugable de Lazy Jo."],
  ["Album marathon on JAVEDA: # of # songs in one run.", "Albummarathon op JAVEDA: # van de # nummers in één run.", "Marathon de l'album sur JAVEDA : # morceaux sur # d'une traite.", "Maratón del álbum en JAVEDA: # de # canciones de una tirada."],
  ["Today's JAVEDA challenge: #. Beat it:", "De JAVEDA-uitdaging van vandaag: #. Versla het:", "Le défi JAVEDA du jour : #. Fais mieux :", "El reto de JAVEDA de hoy: #. Supéralo:"],
  ["on JAVEDA, Lazy Jo's playable album.", "op JAVEDA, het speelbare album van Lazy Jo.", "sur JAVEDA, l'album jouable de Lazy Jo.", "en JAVEDA, el álbum jugable de Lazy Jo."],
  ["endless", "eindeloos", "infini", "infinito"],
  ["Instagram Story", "Instagram-story", "Story Instagram", "Historia de Instagram"],
  ["In the list, pick Instagram, then Story. The link is copied: add a Link sticker and paste it.", "Kies in de lijst Instagram en dan Story. De link is gekopieerd: voeg een linksticker toe en plak hem.", "Dans la liste, choisis Instagram, puis Story. Le lien est copié : ajoute un sticker Lien et colle-le.", "En la lista, elige Instagram y luego Historia. El enlace está copiado: añade un sticker de enlace y pégalo."],
  ["In the list, pick TikTok. The link is copied: paste it in your caption.", "Kies in de lijst TikTok. De link is gekopieerd: plak hem in je bijschrift.", "Dans la liste, choisis TikTok. Le lien est copié : colle-le dans ta légende.", "En la lista, elige TikTok. El enlace está copiado: pégalo en tu descripción."],
  ["Picture saved and link copied. Post the picture from your phone and paste the link.", "Foto bewaard en link gekopieerd. Post de foto vanaf je telefoon en plak de link.", "Image enregistrée et lien copié. Publie l'image depuis ton téléphone et colle le lien.", "Imagen guardada y enlace copiado. Publica la imagen desde tu teléfono y pega el enlace."],
  ["Share the picture", "Deel de foto", "Partager l'image", "Compartir la imagen"],
  ["Send the link - it shows the JAVEDA preview in the chat. Or put the picture in your story.", "Stuur de link - dan zie je de JAVEDA-preview in de chat. Of zet de foto in je story.", "Envoie le lien - l'aperçu JAVEDA s'affiche dans la discussion. Ou mets l'image dans ta story.", "Envía el enlace - se ve la vista previa de JAVEDA en el chat. O pon la imagen en tu historia."],
  ["Save the picture and post it to your story. The link to play is on it.", "Bewaar de foto en zet hem in je story. De link om te spelen staat erop.", "Enregistre l'image et publie-la dans ta story. Le lien pour jouer est dessus.", "Guarda la imagen y súbela a tu historia. El enlace para jugar está en ella."],
  ["I finished JAVEDA - all 28 songs of Lazy Jo's playable album.", "Ik heb JAVEDA uitgespeeld - alle 28 nummers van het speelbare album van Lazy Jo.", "J'ai fini JAVEDA - les 28 morceaux de l'album jouable de Lazy Jo.", "He terminado JAVEDA - las 28 canciones del álbum jugable de Lazy Jo."],
  // continue, finale, marathon, daily
  ["Next level", "Volgend level", "Niveau suivant", "Siguiente nivel"],
  ["JAVEDA Complete", "JAVEDA uitgespeeld", "JAVEDA terminé", "JAVEDA completado"],
  ["The album marathon opens when every part of all 28 songs is cleared.", "De albummarathon gaat open als elk deel van alle 28 nummers is uitgespeeld.", "Le marathon de l'album s'ouvre quand chaque partie des 28 morceaux est terminée.", "El maratón del álbum se abre cuando superas todas las partes de las 28 canciones."],
  ["New marathon best!", "Nieuw marathonrecord!", "Nouveau record du marathon !", "¡Nuevo récord del maratón!"],
  ["JAVEDA: HYPERDRIVE and the album marathon", "JAVEDA: HYPERDRIVE en de albummarathon", "JAVEDA : HYPERDRIVE et le marathon de l'album", "JAVEDA: HYPERDRIVE y el maratón del álbum"],
  ["to put your runs on the marathon board.", "om je runs op het marathonbord te zetten.", "pour mettre tes parties au classement du marathon.", "para poner tus partidas en la tabla del maratón."],
  ["Today's best is still", "Het record van vandaag is nog steeds", "Le record du jour est toujours", "El récord de hoy sigue siendo"],
  ["That daily run didn't save:", "Die dagelijkse run is niet bewaard:", "Cette partie du jour n'a pas été enregistrée :", "Esa partida diaria no se guardó:"],
  ["to get on the daily board.", "om op het dagbord te komen.", "pour entrer au classement du jour.", "para entrar en la tabla del día."],
  // the Pass
  ["⚡ JAVEDA Pass", "⚡ JAVEDA Pass", "⚡ Pass JAVEDA", "⚡ Pase JAVEDA"],
  ["Get the Pass", "Neem de Pass", "Prendre le Pass", "Consigue el Pase"],
  ["See it free", "Gratis bekijken", "Voir gratuitement", "Verlo gratis"],
  ["The whole album, yours", "Het hele album, van jou", "Tout l'album, à toi", "Todo el álbum, tuyo"],
  ["Every Part 2, 3 and 4 of all 28 songs", "Elk Deel 2, 3 en 4 van alle 28 nummers", "Chaque Partie 2, 3 et 4 des 28 morceaux", "Todas las Partes 2, 3 y 4 de las 28 canciones"],
  ["Every endless and remix, and a place on their scoreboards", "Elke eindeloze versie en remix, en een plek op hun scoreborden", "Chaque mode infini et chaque remix, et une place à leurs classements", "Todos los infinitos y remixes, y un lugar en sus clasificaciones"],
  ["One payment, no subscription. Yours for good.", "Eén keer betalen, geen abonnement. Voorgoed van jou.", "Un seul paiement, pas d'abonnement. À toi pour toujours.", "Un solo pago, sin suscripción. Tuyo para siempre."],
  ["Part 1 of every song, the daily challenge and the online games stay free. With the Pass you still open each part by clearing the one before it.", "Deel 1 van elk nummer, de dagelijkse uitdaging en de online spellen blijven gratis. Met de Pass open je nog steeds elk deel door het vorige uit te spelen.", "La Partie 1 de chaque morceau, le défi du jour et les jeux en ligne restent gratuits. Avec le Pass, tu ouvres toujours chaque partie en terminant la précédente.", "La Parte 1 de cada canción, el reto diario y los juegos online siguen siendo gratis. Con el Pase sigues abriendo cada parte al superar la anterior."],
  ["A code from EVEN or your merch", "Een code van EVEN of je merch", "Un code d'EVEN ou de ton merch", "Un código de EVEN o de tu merch"],
  ["A merch code opens every remix straight away too. No code?", "Een merchcode opent ook meteen elke remix. Geen code?", "Un code merch ouvre aussi tous les remix tout de suite. Pas de code ?", "Un código de merch también abre todos los remixes al instante. ¿Sin código?"],
  ["Redeem", "Inwisselen", "Utiliser", "Canjear"],
  ["Unlock with the JAVEDA Pass", "Ontgrendel met de JAVEDA Pass", "Débloque avec le Pass JAVEDA", "Desbloquea con el Pase JAVEDA"],
  ["Log in first: the Pass goes on your account.", "Log eerst in: de Pass komt op je account.", "Connecte-toi d'abord : le Pass va sur ton compte.", "Inicia sesión primero: el Pase va a tu cuenta."],
  ["No payment made. The Pass is here whenever you want it.", "Er is niet betaald. De Pass staat hier klaar wanneer je maar wilt.", "Aucun paiement effectué. Le Pass est là quand tu veux.", "No se ha hecho ningún pago. El Pase está aquí cuando quieras."],
  ["Log in with the account you paid with: the Pass is on it.", "Log in met het account waarmee je betaald hebt: daar staat de Pass op.", "Connecte-toi avec le compte qui a payé : le Pass est dessus.", "Inicia sesión con la cuenta con la que pagaste: el Pase está en ella."],
  ["Your payment is going through. The Pass shows up as soon as it's done: refresh in a minute.", "Je betaling wordt verwerkt. De Pass verschijnt zodra het klaar is: ververs over een minuutje.", "Ton paiement est en cours. Le Pass apparaît dès que c'est fait : actualise dans une minute.", "Tu pago se está procesando. El Pase aparece en cuanto termine: recarga en un minuto."],
  // the music links
  ["🎧 Spotify", "🎧 Spotify", "🎧 Spotify", "🎧 Spotify"],
  ["👕 Merch", "👕 Merch", "👕 Merch", "👕 Merch"],
  ["💜 EVEN · true fans", "💜 EVEN · echte fans", "💜 EVEN · vrais fans", "💜 EVEN · fans de verdad"],
  ["💬 Discord", "💬 Discord", "💬 Discord", "💬 Discord"],
  // dialogs, labels
  ["Close", "Sluiten", "Fermer", "Cerrar"],
  ["✕ Close", "✕ Sluiten", "✕ Fermer", "✕ Cerrar"],
  ["Your profile", "Je profiel", "Ton profil", "Tu perfil"],
  ["Where you are", "Waar je bent", "Où tu en es", "Dónde estás"],
  ["JAVEDA level", "JAVEDA-level", "Niveau JAVEDA", "Nivel JAVEDA"],
  ["Where players get stuck", "Waar spelers vastlopen", "Où les joueurs bloquent", "Dónde se atascan los jugadores"],
  ["Every logged-in player but the creators.", "Elke ingelogde speler behalve de makers.", "Chaque joueur connecté sauf les créateurs.", "Todos los jugadores con sesión iniciada salvo los creadores."],
  ["stuck", "vast", "bloqués", "atascados"],
  ["never tried", "nooit geprobeerd", "jamais essayé", "nunca lo intentaron"],
  // the level descriptions (the part's own line: "Part 2." is put back by a pattern)
  ["Fly the blue saucer down the corridor. Round the walls, over the holes.", "Vlieg de blauwe ufo door de gang. Om de muren heen, over de gaten.", "Pilote la soucoupe bleue dans le couloir. Contourne les murs, saute les trous.", "Vuela el platillo azul por el pasillo. Esquiva los muros, salta los agujeros."],
  ["The Dust Sea, alone in the saucer. Hold the sand till somebody comes. Ft Zirka.", "De Stofzee, alleen in de ufo. Houd het zand tegen tot er iemand komt. Ft Zirka.", "La Mer de poussière, seul dans la soucoupe. Retiens le sable jusqu'à ce que quelqu'un arrive. Ft Zirka.", "El Mar de Polvo, solo en el platillo. Aguanta la arena hasta que llegue alguien. Ft Zirka."],
  ["Be Zirka: ride the purple bike across the Dust Sea to find Jo. Clear it to ride his bike in Level 1.", "Wees Zirka: rij op de paarse motor over de Stofzee om Jo te vinden. Speel het uit en rij zijn motor in Level 1.", "Incarne Zirka : traverse la Mer de poussière sur la moto violette pour retrouver Jo. Termine-le pour piloter sa moto au niveau 1.", "Sé Zirka: cruza el Mar de Polvo en la moto morada para encontrar a Jo. Supéralo para usar su moto en el nivel 1."],
  ["A forest at night under a broken heart. Fly the red saucer and find the five pieces. Follow the heartbeat.", "Een bos bij nacht onder een gebroken hart. Vlieg de rode ufo en vind de vijf stukjes. Volg de hartslag.", "Une forêt la nuit sous un cœur brisé. Pilote la soucoupe rouge et trouve les cinq morceaux. Suis le battement du cœur.", "Un bosque de noche bajo un corazón roto. Vuela el platillo rojo y encuentra las cinco piezas. Sigue el latido."],
  ["Darker, 7 pieces, ghosts guarding them in pairs, and 3 hearts.", "Donkerder, 7 stukjes, spoken die ze per twee bewaken, en 3 hartjes.", "Plus sombre, 7 morceaux, des fantômes qui les gardent par deux, et 3 cœurs.", "Más oscuro, 7 piezas, fantasmas que las vigilan en parejas y 3 corazones."],
  ["9 pieces that only glow on the heartbeat, 3 hearts, and three minutes before the night is over.", "9 stukjes die alleen oplichten op de hartslag, 3 hartjes, en drie minuten voor de nacht voorbij is.", "9 morceaux qui ne brillent qu'au rythme du cœur, 3 cœurs, et trois minutes avant la fin de la nuit.", "9 piezas que solo brillan con el latido, 3 corazones y tres minutos antes de que acabe la noche."],
  ["A music game: ride the song on a neon coaster to the lightning portal. Move the UFO lane to lane to catch the lights and dodge the red walls.", "Een muziekspel: rij het nummer op een neon achtbaan naar het bliksemportaal. Beweeg de ufo van baan naar baan om de lichtjes te vangen en de rode muren te ontwijken.", "Un jeu musical : parcours le morceau sur des montagnes russes au néon jusqu'au portail d'éclairs. Déplace l'OVNI de voie en voie pour attraper les lumières et éviter les murs rouges.", "Un juego musical: recorre la canción en una montaña rusa de neón hasta el portal de rayos. Mueve el OVNI de carril en carril para coger las luces y esquivar los muros rojos."],
  ["Every kick drum is a light, and walls that close two lanes. Score 100,000 to open Part 3.", "Elke kickdrum is een lichtje, en muren die twee banen afsluiten. Scoor 100.000 om Deel 3 te openen.", "Chaque grosse caisse est une lumière, et des murs ferment deux voies. Marque 100 000 pour ouvrir la Partie 3.", "Cada bombo es una luz, y hay muros que cierran dos carriles. Consigue 100.000 para abrir la Parte 3."],
  ["No brakes, no lanes: drag to fly the UFO free through rings of lightning, round the storm mines.", "Geen remmen, geen banen: sleep om de ufo vrij door ringen van bliksem te vliegen, om de stormmijnen heen.", "Pas de freins, pas de voies : fais glisser pour piloter l'OVNI librement à travers des anneaux d'éclairs, autour des mines de tempête.", "Sin frenos, sin carriles: arrastra para volar el OVNI libre entre anillos de rayos, esquivando las minas de tormenta."],
  ["The park from the cover, every lamp dark. Fly the green saucer, gather fireflies in a glowing trail and bring them to the lamps. Mind the moths.", "Het park van de cover, elke lamp uit. Vlieg de groene ufo, verzamel vuurvliegjes in een gloeiend spoor en breng ze naar de lampen. Pas op voor de motten.", "Le parc de la pochette, chaque lampe éteinte. Pilote la soucoupe verte, rassemble des lucioles en une traînée lumineuse et apporte-les aux lampes. Attention aux papillons de nuit.", "El parque de la portada, todas las farolas apagadas. Vuela el platillo verde, reúne luciérnagas en una estela brillante y llévalas a las farolas. Cuidado con las polillas."],
  ["8 lamps, 4 moths, and flying through your own trail breaks it.", "8 lampen, 4 motten, en door je eigen spoor vliegen breekt het.", "8 lampes, 4 papillons de nuit, et traverser ta propre traînée la brise.", "8 farolas, 4 polillas, y cruzar tu propia estela la rompe."],
  ["The lamps burn down: keep feeding them and get all 8 lit at the same time. 3 hearts - every moth takes one.", "De lampen branden op: blijf ze voeden en laat alle 8 tegelijk branden. 3 hartjes - elke mot kost er één.", "Les lampes s'éteignent peu à peu : continue de les nourrir et allume les 8 en même temps. 3 cœurs - chaque papillon de nuit en prend un.", "Las farolas se apagan: sigue alimentándolas y enciende las 8 a la vez. 3 corazones - cada polilla se lleva uno."],
  ["The beach from the cover at sunset. Island Hopper: hop the green saucer rock to palm to rock across the sea to the stone arch.", "Het strand van de cover bij zonsondergang. Island Hopper: spring met de groene ufo van rots naar palm naar rots over zee naar de stenen boog.", "La plage de la pochette au coucher du soleil. Island Hopper : fais sauter la soucoupe verte de rocher en palmier jusqu'à l'arche de pierre.", "La playa de la portada al atardecer. Island Hopper: salta con el platillo verde de roca en palmera por el mar hasta el arco de piedra."],
  ["Hold the stone arch: beam the crabs back to the sea. Shots on the beat are free. Five crabs on the arch and it falls.", "Houd de stenen boog: straal de krabben terug de zee in. Schoten op de beat zijn gratis. Vijf krabben op de boog en hij valt.", "Défends l'arche de pierre : renvoie les crabes à la mer avec ton rayon. Les tirs en rythme sont gratuits. Cinq crabes sur l'arche et elle tombe.", "Defiende el arco de piedra: devuelve los cangrejos al mar con tu rayo. Los disparos al ritmo son gratis. Cinco cangrejos en el arco y se cae."],
  ["Skim the sea to the sun: jump the waves, dodge the rocks, grab the lights.", "Scheer over de zee naar de zon: spring over de golven, ontwijk de rotsen, pak de lichtjes.", "File sur la mer vers le soleil : saute les vagues, évite les rochers, attrape les lumières.", "Desliza sobre el mar hacia el sol: salta las olas, esquiva las rocas, coge las luces."],
  ["From the Earth in your hands to Planet Javeda. Shield each planet from its meteor shower, then launch to the next when the song breathes.", "Van de aarde in je handen naar Planeet Javeda. Bescherm elke planeet tegen zijn meteorenregen en lanceer naar de volgende als het nummer ademt.", "De la Terre entre tes mains à la planète Javeda. Protège chaque planète de sa pluie de météores, puis décolle vers la suivante quand le morceau respire.", "De la Tierra en tus manos al Planeta Javeda. Protege cada planeta de su lluvia de meteoritos y despega al siguiente cuando la canción respira."],
  ["Faster meteors, a narrower shield, and asteroids drifting between the planets.", "Snellere meteoren, een smaller schild, en asteroïden die tussen de planeten zweven.", "Des météores plus rapides, un bouclier plus étroit, et des astéroïdes qui dérivent entre les planètes.", "Meteoritos más rápidos, un escudo más estrecho y asteroides flotando entre los planetas."],
  ["A meteor every beat, and they hunt the ship in flight too. 4 hearts.", "Een meteoor op elke beat, en ze jagen ook op het schip in de lucht. 4 hartjes.", "Un météore à chaque temps, et ils chassent aussi le vaisseau en vol. 4 cœurs.", "Un meteorito en cada golpe, y también persiguen la nave en vuelo. 4 corazones."],
  ["The canyon from the cover at sunset, and a giant rose losing its petals. Petal Rain: catch them in the saucer's green beam before they hit the ground.", "De canyon van de cover bij zonsondergang, en een reuzenroos die haar blaadjes verliest. Petal Rain: vang ze in de groene straal van de ufo voor ze de grond raken.", "Le canyon de la pochette au coucher du soleil, et une rose géante qui perd ses pétales. Petal Rain : attrape-les dans le rayon vert de la soucoupe avant qu'ils touchent le sol.", "El cañón de la portada al atardecer y una rosa gigante que pierde sus pétalos. Petal Rain: atrápalos con el rayo verde del platillo antes de que toquen el suelo."],
  ["Climb the giant stem to the bloom: swing round it past the thorns, and find the gap in each ring.", "Klim langs de reuzenstengel naar de bloem: zwaai eromheen langs de doornen en vind de opening in elke ring.", "Grimpe la tige géante jusqu'à la fleur : tourne autour en évitant les épines, et trouve l'ouverture de chaque anneau.", "Sube por el tallo gigante hasta la flor: gira a su alrededor esquivando las espinas y encuentra el hueco de cada anillo."],
  ["Your shadow flies exactly where you flew a few seconds ago. Gather the petals and stay ahead of yourself.", "Je schaduw vliegt precies waar jij een paar seconden geleden vloog. Verzamel de blaadjes en blijf jezelf voor.", "Ton ombre vole exactement là où tu volais il y a quelques secondes. Ramasse les pétales et garde une longueur d'avance sur toi-même.", "Tu sombra vuela justo por donde volabas hace unos segundos. Recoge los pétalos y mantente por delante de ti mismo."],
  ["District 9 at night with Zirka. Night Flight: Jo's saucer between the neon towers, lightning on the beat, the monsters of forgetting.", "District 9 bij nacht met Zirka. Night Flight: Jo's ufo tussen de neontorens, bliksem op de beat, de monsters van het vergeten.", "District 9 la nuit avec Zirka. Night Flight : la soucoupe de Jo entre les tours de néon, des éclairs en rythme, les monstres de l'oubli.", "District 9 de noche con Zirka. Night Flight: el platillo de Jo entre las torres de neón, rayos al ritmo, los monstruos del olvido."],
  ["Zirka's bike over the roofs: jump the gaps on the 1, swerve the rest, and Zirka's gun takes the monsters that dive in.", "Zirka's motor over de daken: spring over de gaten op de 1, ontwijk de rest, en Zirka's geweer pakt de monsters die naar binnen duiken.", "La moto de Zirka sur les toits : saute les trous sur le 1, évite le reste, et le pistolet de Zirka abat les monstres qui plongent.", "La moto de Zirka por los tejados: salta los huecos en el 1, esquiva el resto y la pistola de Zirka acaba con los monstruos que se lanzan."],
  ["The King of Forgetting over District 9. Dodge his orbs, grab the gadgets, hand the fight to Zirka on the roof - bring him down before the song ends.", "De Koning van het Vergeten boven District 9. Ontwijk zijn bollen, pak de gadgets, geef het gevecht door aan Zirka op het dak - haal hem neer voor het nummer afloopt.", "Le Roi de l'Oubli au-dessus de District 9. Esquive ses orbes, attrape les gadgets, passe le combat à Zirka sur le toit - abats-le avant la fin du morceau.", "El Rey del Olvido sobre District 9. Esquiva sus orbes, coge los gadgets, pasa la pelea a Zirka en el tejado - derríbalo antes de que acabe la canción."],
  ["The city from the cover at night. Freefall: Jo's orange saucer drops down between the towers - through the hole in each skybridge, past the cranes and the helicopters.", "De stad van de cover bij nacht. Freefall: Jo's oranje ufo valt tussen de torens - door het gat in elke luchtbrug, langs de kranen en de helikopters.", "La ville de la pochette la nuit. Freefall : la soucoupe orange de Jo plonge entre les tours - à travers le trou de chaque passerelle, entre les grues et les hélicoptères.", "La ciudad de la portada de noche. Freefall: el platillo naranja de Jo cae entre las torres - por el hueco de cada pasarela, entre las grúas y los helicópteros."],
  ["A night race through the city, towards the moon. Street Race: hold to drift round the corners, nitro on the beat - be first to the river.", "Een nachtelijke race door de stad, richting de maan. Street Race: ingedrukt houden om door de bochten te driften, nitro op de beat - wees als eerste bij de rivier.", "Une course de nuit dans la ville, vers la lune. Street Race : maintiens pour drifter dans les virages, nitro en rythme - sois le premier à la rivière.", "Una carrera nocturna por la ciudad, hacia la luna. Street Race: mantén para derrapar en las curvas, nitro al ritmo - sé el primero en llegar al río."],
  ["The hologram clockwork on the stage. Pendulum Swing: Jo's saucer hooks its beam onto the pendulums - swing higher, let go on the beat, fly.", "Het hologram-uurwerk op het podium. Pendulum Swing: Jo's ufo haakt zijn straal aan de slingers - zwaai hoger, laat los op de beat, vlieg.", "Le mécanisme d'horloge en hologramme sur la scène. Pendulum Swing : la soucoupe de Jo accroche son rayon aux pendules - balance-toi plus haut, lâche en rythme, vole.", "El mecanismo de reloj en holograma sobre el escenario. Pendulum Swing: el platillo de Jo engancha su rayo a los péndulos - balancéate más alto, suelta al ritmo, vuela."],
  ["The room from the cover, from above. Light Trails: Jo's saucer never stops - it draws light on the rug. Never cross your own line, dodge the pillows.", "De kamer van de cover, van bovenaf. Light Trails: Jo's ufo stopt nooit - hij tekent licht op het tapijt. Kruis nooit je eigen lijn, ontwijk de kussens.", "La chambre de la pochette, vue d'en haut. Light Trails : la soucoupe de Jo ne s'arrête jamais - elle dessine de la lumière sur le tapis. Ne croise jamais ta propre ligne, évite les coussins.", "La habitación de la portada, desde arriba. Light Trails: el platillo de Jo nunca para - dibuja luz en la alfombra. Nunca cruces tu propia línea, esquiva los cojines."],
  ["Inside the neon cup from the cover. Ice Breaker: the saucer is the paddle, a purple drop the ball - smash the ice, power shots on the beat.", "In de neonbeker van de cover. Ice Breaker: de ufo is het batje, een paarse druppel de bal - sla het ijs kapot, krachtschoten op de beat.", "Dans le gobelet néon de la pochette. Ice Breaker : la soucoupe est la raquette, une goutte violette la balle - brise la glace, tirs puissants en rythme.", "Dentro del vaso de neón de la portada. Ice Breaker: el platillo es la pala, una gota morada la bola - rompe el hielo, tiros potentes al ritmo."],
  ["The old street from the cover at dusk, in the fog. Haunted Windows: ghosts come up in the windows on the beat - tap them, never the neighbours.", "De oude straat van de cover in de schemering, in de mist. Haunted Windows: spoken verschijnen in de ramen op de beat - tik ze aan, nooit de buren.", "La vieille rue de la pochette au crépuscule, dans le brouillard. Haunted Windows : des fantômes apparaissent aux fenêtres en rythme - touche-les, jamais les voisins.", "La vieja calle de la portada al anochecer, entre la niebla. Haunted Windows: aparecen fantasmas en las ventanas al ritmo - tócalos, nunca a los vecinos."],
  ["Lazy Jo feat. Zirka, in the white sky from the cover. Hoops: hold to wind up, let go in the green - on the beat it's a swish. Then play it 1v1 online.", "Lazy Jo feat. Zirka, in de witte lucht van de cover. Hoops: ingedrukt houden om op te laden, loslaten in het groen - op de beat is het een swish. Speel het daarna 1v1 online.", "Lazy Jo feat. Zirka, dans le ciel blanc de la pochette. Hoops : maintiens pour armer, lâche dans le vert - en rythme c'est un swish. Puis joue-le en 1v1 en ligne.", "Lazy Jo feat. Zirka, en el cielo blanco de la portada. Hoops: mantén para cargar, suelta en el verde - al ritmo es un swish. Luego juégalo 1v1 online."],
  ["The blue sky and the islands from the cover. Island Blocks: the saucer carries the pieces down into a frame in the sea - fill a row, on the beat it's double.", "De blauwe lucht en de eilanden van de cover. Island Blocks: de ufo brengt de stukken omlaag in een raam in de zee - vul een rij, op de beat telt het dubbel.", "Le ciel bleu et les îles de la pochette. Island Blocks : la soucoupe descend les pièces dans un cadre en mer - remplis une ligne, en rythme c'est double.", "El cielo azul y las islas de la portada. Island Blocks: el platillo baja las piezas a un marco en el mar - completa una fila, al ritmo cuenta doble."],
  ["The rainy night from the cover. Unblock: the blue car is boxed in a car park - slide the others out of its way. Car park after car park through the song.", "De regenachtige nacht van de cover. Unblock: de blauwe auto staat klem op een parkeerplaats - schuif de andere uit de weg. Parkeerplaats na parkeerplaats, het hele nummer door.", "La nuit pluvieuse de la pochette. Unblock : la voiture bleue est coincée dans un parking - fais glisser les autres pour la libérer. Parking après parking tout au long du morceau.", "La noche lluviosa de la portada. Unblock: el coche azul está atrapado en un aparcamiento - desliza los demás para abrirle paso. Aparcamiento tras aparcamiento durante toda la canción."],
  ["Turn the mirrors on the wet street so the saucer's beam reaches the car's headlights, round the umbrellas.", "Draai de spiegels op de natte straat zodat de straal van de ufo de koplampen van de auto bereikt, om de paraplu's heen.", "Tourne les miroirs dans la rue mouillée pour que le rayon de la soucoupe atteigne les phares de la voiture, en contournant les parapluies.", "Gira los espejos en la calle mojada para que el rayo del platillo llegue a los faros del coche, rodeando los paraguas."],
  ["Jo's studio at night from the cover. Pad Memory: the drum machine plays a pattern on the beat - play it back, one more pad every round.", "Jo's studio bij nacht van de cover. Pad Memory: de drumcomputer speelt een patroon op de beat - speel het na, elke ronde een pad erbij.", "Le studio de Jo la nuit, comme sur la pochette. Pad Memory : la boîte à rythmes joue une séquence en rythme - rejoue-la, un pad de plus à chaque manche.", "El estudio de Jo de noche, como en la portada. Pad Memory: la caja de ritmos toca un patrón al ritmo - repítelo, un pad más cada ronda."],
  ["The chill version, the crowd from the cover under the blue light. Pass It On: the lights play a pattern and add one - play it back, add your own. Then play it 1v1 online.", "De chille versie, het publiek van de cover onder het blauwe licht. Pass It On: de lichtjes spelen een patroon en voegen er één toe - speel het na, voeg je eigen toe. Speel het daarna 1v1 online.", "La version chill, la foule de la pochette sous la lumière bleue. Pass It On : les lumières jouent une séquence et en ajoutent une - rejoue-la, ajoute la tienne. Puis joue-le en 1v1 en ligne.", "La versión chill, el público de la portada bajo la luz azul. Pass It On: las luces tocan un patrón y añaden una - repítelo, añade la tuya. Luego juégalo 1v1 online."],
  ["Her pink room and his purple one from the cover. Love Cards: the cards face down on her bed - turn two, find the pairs. Then play it 1v1 online.", "Haar roze kamer en zijn paarse van de cover. Love Cards: de kaarten liggen omgekeerd op haar bed - draai er twee om, vind de paren. Speel het daarna 1v1 online.", "Sa chambre rose à elle et sa chambre violette à lui, comme sur la pochette. Love Cards : les cartes face cachée sur son lit - retournes-en deux, trouve les paires. Puis joue-le en 1v1 en ligne.", "Su habitación rosa y la morada de él, como en la portada. Love Cards: las cartas boca abajo sobre su cama - da la vuelta a dos, encuentra las parejas. Luego juégalo 1v1 online."],
  ["Her pile and his turn a card on every beat - the same picture on both: SNAP. A heart and a broken heart aren't the same.", "Haar stapel en de zijne draaien op elke beat een kaart om - op allebei hetzelfde plaatje: SNAP. Een hart en een gebroken hart zijn niet hetzelfde.", "Sa pile et la sienne retournent une carte à chaque temps - la même image des deux côtés : SNAP. Un cœur et un cœur brisé, ce n'est pas pareil.", "Su montón y el de él giran una carta en cada golpe - la misma imagen en los dos: SNAP. Un corazón y un corazón roto no son lo mismo."],
  ["Deep space from the cover - the rainbow, the gold moon, the two kids in the red flying car. Planet Match: swap two planets, three of a colour burst.", "De diepe ruimte van de cover - de regenboog, de gouden maan, de twee kinderen in de rode vliegende auto. Planet Match: wissel twee planeten, drie van een kleur spatten uiteen.", "L'espace profond de la pochette - l'arc-en-ciel, la lune dorée, les deux enfants dans la voiture rouge volante. Planet Match : échange deux planètes, trois d'une même couleur éclatent.", "El espacio profundo de la portada - el arcoíris, la luna dorada, los dos niños en el coche rojo volador. Planet Match: cambia dos planetas, tres del mismo color explotan."],
  ["Glass tubes with the planets mixed up - one colour to every tube.", "Glazen buizen met de planeten door elkaar - één kleur per buis.", "Des tubes de verre avec les planètes mélangées - une couleur par tube.", "Tubos de cristal con los planetas mezclados - un color por tubo."],
  ["The solitaire in the stars - one higher or one lower, streaks count more and more.", "Solitaire tussen de sterren - één hoger of één lager, reeksen tellen steeds meer.", "Le solitaire dans les étoiles - un au-dessus ou un en dessous, les séries comptent de plus en plus.", "El solitario entre las estrellas - uno más alto o uno más bajo, las rachas cuentan cada vez más."],
  ["The sky from the cover - pink and white clouds, the open book with the lavender smoke heart. Heart Pop: aim, let go, three of a colour burst.", "De lucht van de cover - roze en witte wolken, het open boek met het lavendelkleurige rookhart. Heart Pop: richt, laat los, drie van een kleur spatten uiteen.", "Le ciel de la pochette - nuages roses et blancs, le livre ouvert avec le cœur de fumée lavande. Heart Pop : vise, lâche, trois d'une même couleur éclatent.", "El cielo de la portada - nubes rosas y blancas, el libro abierto con el corazón de humo lavanda. Heart Pop: apunta, suelta, tres del mismo color explotan."],
  ["A page of letters in the book - drag across every word on the list and the page turns.", "Een pagina vol letters in het boek - sleep over elk woord op de lijst en de pagina slaat om.", "Une page de lettres dans le livre - fais glisser sur chaque mot de la liste et la page se tourne.", "Una página de letras en el libro - arrastra sobre cada palabra de la lista y la página pasa."],
  ["2048 with hearts - swipe, two the same become one. Keep moving or they drop in.", "2048 met hartjes - veeg, twee dezelfde worden er één. Blijf bewegen of ze vallen erin.", "2048 avec des cœurs - glisse, deux identiques n'en font plus qu'un. Continue de bouger ou ils tombent dedans.", "2048 con corazones - desliza, dos iguales se convierten en uno. Sigue moviéndote o caen dentro."],
  ["The terrace from the cover at sunset - the round table, the bouquet, the cups. Sunset Swap: pictures cut into squares, swap them back.", "Het terras van de cover bij zonsondergang - de ronde tafel, het boeket, de kopjes. Sunset Swap: foto's in vierkantjes geknipt, wissel ze terug.", "La terrasse de la pochette au coucher du soleil - la table ronde, le bouquet, les tasses. Sunset Swap : des images découpées en carrés, remets-les en place.", "La terraza de la portada al atardecer - la mesa redonda, el ramo, las tazas. Sunset Swap: imágenes cortadas en cuadrados, vuelve a colocarlas."],
  ["The beach from the cover at night - the glowing heart over the sea, the red pickup. Heart Flow: link the pairs of hearts, lines can't cross.", "Het strand van de cover bij nacht - het gloeiende hart boven de zee, de rode pick-up. Heart Flow: verbind de paren hartjes, lijnen mogen niet kruisen.", "La plage de la pochette la nuit - le cœur lumineux au-dessus de la mer, le pick-up rouge. Heart Flow : relie les paires de cœurs, les lignes ne peuvent pas se croiser.", "La playa de la portada de noche - el corazón brillante sobre el mar, la camioneta roja. Heart Flow: une las parejas de corazones, las líneas no pueden cruzarse."],
  ["Dig the mounds - the numbers count the crabs around. Flag them, and keep digging before the tide comes in.", "Graaf de heuveltjes op - de cijfers tellen de krabben eromheen. Markeer ze, en blijf graven voor het tij opkomt.", "Creuse les monticules - les chiffres comptent les crabes autour. Marque-les d'un drapeau, et continue de creuser avant que la marée monte.", "Excava los montículos - los números cuentan los cangrejos de alrededor. Márcalos y sigue excavando antes de que suba la marea."],
  ["Stars in the sand: tap one and it changes, and so do the four next to it. Light them all.", "Sterren in het zand: tik er één aan en hij verandert, net als de vier ernaast. Laat ze allemaal oplichten.", "Des étoiles dans le sable : touches-en une et elle change, ainsi que les quatre à côté. Allume-les toutes.", "Estrellas en la arena: toca una y cambia, y también las cuatro de al lado. Enciéndelas todas."],
  ["A sudoku with pictures from the beach - each one once in every row, column and box.", "Een sudoku met plaatjes van het strand - elk één keer in elke rij, kolom en vak.", "Un sudoku avec des images de la plage - chacune une fois par ligne, colonne et carré.", "Un sudoku con imágenes de la playa - cada una una vez en cada fila, columna y caja."],
  ["The night from the cover - the lasers over the black car with the pink hood. Neon Pinball: score the target and the next table comes in, harder every time.", "De nacht van de cover - de lasers boven de zwarte auto met de roze motorkap. Neon Pinball: raak het doel en de volgende tafel komt eraan, elke keer moeilijker.", "La nuit de la pochette - les lasers au-dessus de la voiture noire au capot rose. Neon Pinball : touche la cible et la table suivante arrive, plus dure à chaque fois.", "La noche de la portada - los láseres sobre el coche negro con el capó rosa. Neon Pinball: acierta el objetivo y llega la siguiente mesa, cada vez más difícil."],
  ["Push every speaker onto a glowing pad - the saucer can push but never pull. Keep them out of the corners.", "Duw elke speaker op een gloeiend vak - de ufo kan duwen maar nooit trekken. Houd ze uit de hoeken.", "Pousse chaque enceinte sur une dalle lumineuse - la soucoupe peut pousser mais jamais tirer. Garde-les loin des coins.", "Empuja cada altavoz a una baldosa brillante - el platillo puede empujar pero nunca tirar. Mantenlos lejos de las esquinas."],
  ["High in the sky from the cover - the cloud sea, the car made of cloud. Untangle: drag the birds until no strings of light cross.", "Hoog in de lucht van de cover - de wolkenzee, de auto van wolken. Untangle: sleep de vogels tot er geen lichtdraden meer kruisen.", "Haut dans le ciel de la pochette - la mer de nuages, la voiture en nuage. Untangle : déplace les oiseaux jusqu'à ce qu'aucun fil de lumière ne se croise.", "En lo alto del cielo de la portada - el mar de nubes, el coche hecho de nube. Untangle: arrastra los pájaros hasta que ningún hilo de luz se cruce."],
  ["Crack the order the birds are hiding in - the gold and blue beads tell you how close each try is.", "Kraak de volgorde waarin de vogels zich verstoppen - de gouden en blauwe kraaltjes vertellen hoe dichtbij elke poging is.", "Trouve l'ordre dans lequel les oiseaux se cachent - les perles dorées et bleues te disent à quel point chaque essai est proche.", "Descifra el orden en que se esconden los pájaros - las cuentas doradas y azules te dicen lo cerca que está cada intento."],
  ["The city at sunset from the top of a tower. Rooftop Golf: nine holes on the roofs, each with something new - or online for 2, 3 or 4.", "De stad bij zonsondergang vanaf een toren. Rooftop Golf: negen holes op de daken, elk met iets nieuws - of online met 2, 3 of 4.", "La ville au coucher du soleil depuis le haut d'une tour. Rooftop Golf : neuf trous sur les toits, chacun avec du nouveau - ou en ligne à 2, 3 ou 4.", "La ciudad al atardecer desde lo alto de una torre. Rooftop Golf: nueve hoyos en los tejados, cada uno con algo nuevo - u online para 2, 3 o 4."],
  ["Air hockey on a roof against the shadow - first to 3 takes a round, and every round has something new.", "Airhockey op een dak tegen de schaduw - wie het eerst 3 heeft, wint de ronde, en elke ronde heeft iets nieuws.", "Du air hockey sur un toit contre l'ombre - le premier à 3 gagne la manche, et chaque manche apporte du nouveau.", "Hockey de aire en un tejado contra la sombra - el primero en llegar a 3 gana la ronda, y cada ronda trae algo nuevo."],
  ["Level #", "Level #", "Niveau #", "Nivel #"],
  ["# parts", "# delen", "# parties", "# partes"],
  ["# Remix", "# Remix", "# Remix", "# Remix"],
  ["# Remixes", "# Remixes", "# Remix", "# Remixes"],
  ["# Endless", "# Eindeloos", "# Infini", "# Infinito"],
  ["# day", "# dag", "# jour", "# día"],
  ["# days", "# dagen", "# jours", "# días"],
  ["# in a row", "# op rij", "# d'affilée", "# seguidos"],
  ["# win", "# zege", "# victoire", "# victoria"],
  ["# wins", "# zeges", "# victoires", "# victorias"],
  ["Top # x#", "Top # x#", "Top # x#", "Top # x#"],
  ["Pictures", "Foto's", "Images", "Imágenes"],
  ["New picture", "Nieuwe foto", "Nouvelle image", "Nueva imagen"],
  ["+# more", "+# meer", "+# de plus", "+# más"],
  ["Clear every part of all # songs.", "Speel elk deel van alle # nummers uit.", "Termine toutes les parties des # chansons.", "Supera todas las partes de las # canciones."],
  ["Clear every part of Level #.", "Speel elk deel van Level # uit.", "Termine toutes les parties du niveau #.", "Supera todas las partes del nivel #."],
  ["You've cleared # of #.", "Je hebt er # van # uitgespeeld.", "Tu en as terminé # sur #.", "Has superado # de #."],
  ["Clear Level #.", "Speel Level # uit.", "Termine le niveau #.", "Supera el nivel #."],
  ["Clear # parts of the album.", "Speel # delen van het album uit.", "Termine # parties de l'album.", "Supera # partes del álbum."],
  ["You've cleared #.", "Je hebt er # uitgespeeld.", "Tu en as terminé #.", "Has superado #."],
  ["Play a Remix.", "Speel een Remix.", "Joue un Remix.", "Juega un Remix."],
  ["Play # different Remixes.", "Speel # verschillende Remixes.", "Joue # Remix différents.", "Juega # Remixes distintos."],
  ["Play # different Endless modes.", "Speel # verschillende Eindeloos-modi.", "Joue # modes Infini différents.", "Juega # modos Infinito distintos."],
  ["You've played #.", "Je hebt er # gespeeld.", "Tu en as joué #.", "Has jugado #."],
  ["Play the daily challenge.", "Speel de dagelijkse uitdaging.", "Joue le défi du jour.", "Juega el reto diario."],
  ["Play the daily challenge on # days.", "Speel de dagelijkse uitdaging op # dagen.", "Joue le défi du jour pendant # jours.", "Juega el reto diario durante # días."],
  ["You're at #.", "Je zit op #.", "Tu en es à #.", "Llevas #."],
  ["Play the daily challenge # days in a row.", "Speel de dagelijkse uitdaging # dagen op rij.", "Joue le défi du jour # jours d'affilée.", "Juega el reto diario # días seguidos."],
  ["Your best is #.", "Je beste is #.", "Ton record est de #.", "Tu mejor marca es #."],
  ["Finish a day first on the daily board.", "Eindig een dag als eerste op het dagbord.", "Finis un jour premier du classement du jour.", "Termina un día primero en la tabla del día."],
  ["Finish # days first on the daily board.", "Eindig # dagen als eerste op het dagbord.", "Finis # jours premier du classement du jour.", "Termina # días primero en la tabla del día."],
  ["Finish a day in the top # of the daily board.", "Eindig een dag in de top # van het dagbord.", "Finis un jour dans le top # du classement du jour.", "Termina un día en el top # de la tabla del día."],
  ["Finish # days in the top # of the daily board.", "Eindig # dagen in de top # van het dagbord.", "Finis # jours dans le top # du classement du jour.", "Termina # días en el top # de la tabla del día."],
  ["At least # players that day.", "Minstens # spelers die dag.", "Au moins # joueurs ce jour-là.", "Al menos # jugadores ese día."],
  ["You have #.", "Je hebt er #.", "Tu en as #.", "Tienes #."],
  ["Log in to earn it.", "Log in om hem te verdienen.", "Connecte-toi pour la gagner.", "Inicia sesión para ganarla."],
  ["Log in to earn points.", "Log in om punten te verdienen.", "Connecte-toi pour gagner des points.", "Inicia sesión para ganar puntos."],
  ["Costs # points.", "Kost # punten.", "Coûte # points.", "Cuesta # puntos."],
  ["Unlock for # points?", "Ontgrendelen voor # punten?", "Débloquer pour # points ?", "¿Desbloquear por # puntos?"],
  ["You get these by clearing levels. They can't be bought. Tap one to see what it takes.", "Deze krijg je door levels uit te spelen. Je kunt ze niet kopen. Tik erop om te zien wat ervoor nodig is.", "Tu les obtiens en terminant des niveaux. Elles ne s'achètent pas. Touche-en une pour voir ce qu'il faut faire.", "Las consigues superando niveles. No se pueden comprar. Toca una para ver qué hace falta."],
  ["You get these by playing the daily challenge. They can't be bought. Tap one to see what it takes.", "Deze krijg je door de dagelijkse uitdaging te spelen. Je kunt ze niet kopen. Tik erop om te zien wat ervoor nodig is.", "Tu les obtiens en jouant le défi du jour. Elles ne s'achètent pas. Touche-en une pour voir ce qu'il faut faire.", "Las consigues jugando el reto diario. No se pueden comprar. Toca una para ver qué hace falta."],
  // the pictures' names
  ["Blue Saucer","Blauwe ufo","Soucoupe bleue","Platillo azul"],
  ["Zirka's Bike","Zirka's motor","La moto de Zirka","La moto de Zirka"],
  ["Wolf","Wolf","Loup","Lobo"],
  ["Planet Javeda","Planeet Javeda","Planète Javeda","Planeta Javeda"],
  ["Vortex","Vortex","Vortex","Vórtice"],
  ["Night Moon","Nachtmaan","Lune de nuit","Luna de noche"],
  ["Earth","Aarde","Terre","Tierra"],
  ["Green Saucer","Groene ufo","Soucoupe verte","Platillo verde"],
  ["Red Saucer","Rode ufo","Soucoupe rouge","Platillo rojo"],
  ["Orange Saucer","Oranje ufo","Soucoupe orange","Platillo naranja"],
  ["Re-entry","Terugkeer","Rentrée","Reentrada"],
  ["Shooting Star","Vallende ster","Étoile filante","Estrella fugaz"],
  ["Purple Saucer","Paarse ufo","Soucoupe violette","Platillo morado"],
  ["Satellite","Satelliet","Satellite","Satélite"],
  ["Stay Up","Wakker blijven","Reste éveillé","Sin dormir"],
  ["Neon Bike","Neon motor","Moto néon","Moto de neón"],
  ["Ringed Giant","Geringde reus","Géante à anneaux","Gigante anillado"],
  ["Rocket","Raket","Fusée","Cohete"],
  ["Lightning","Bliksem","Éclair","Rayo"],
  ["Astronaut","Astronaut","Astronaute","Astronauta"],
  ["Meteor Storm","Meteorenstorm","Pluie de météores","Tormenta de meteoros"],
  ["Space Station","Ruimtestation","Station spatiale","Estación espacial"],
  ["Aurora","Noorderlicht","Aurore","Aurora"],
  ["Gold Wolf","Gouden wolf","Loup d'or","Lobo de oro"],
  ["Black Hole","Zwart gat","Trou noir","Agujero negro"],
  ["Galaxy","Sterrenstelsel","Galaxie","Galaxia"],
  ["Mothership","Moederschip","Vaisseau-mère","Nave nodriza"],
  ["Chrome Saucer","Chromen ufo","Soucoupe chromée","Platillo cromado"],
  ["Diamond Saucer","Diamanten ufo","Soucoupe de diamant","Platillo de diamante"],
  ["Crowned Saucer","Gekroonde ufo","Soucoupe couronnée","Platillo coronado"],
  ["Golden Planet","Gouden planeet","Planète d'or","Planeta de oro"],
  ["Storm Crown","Stormkroon","Couronne d'orage","Corona de tormenta"],
  ["Legend","Legende","Légende","Leyenda"],
  ["Lost Saucer","Verdwaalde ufo","Soucoupe perdue","Platillo perdido"],
  ["Dust Sea","Stofzee","Mer de poussière","Mar de Polvo"],
  ["Broken Heart","Gebroken hart","Cœur brisé","Corazón roto"],
  ["Neon Coaster","Neon achtbaan","Montagnes néon","Montaña de neón"],
  ["Firefly Park","Vuurvliegpark","Parc aux lucioles","Parque de luciérnagas"],
  ["Palm Rock","Palmrots","Rocher aux palmiers","Roca de palmeras"],
  ["Earth in Hand","Aarde in je hand","La Terre en main","La Tierra en la mano"],
  ["Giant Rose","Reuzenroos","Rose géante","Rosa gigante"],
  ["Orange Drop","Oranje val","Chute orange","Caída naranja"],
  ["Moon Race","Maanrace","Course vers la lune","Carrera a la luna"],
  ["Clockwork","Uurwerk","Horlogerie","Relojería"],
  ["Rug Lights","Tapijtlicht","Lumières sur le tapis","Luces en la alfombra"],
  ["Neon Cup","Neon beker","Gobelet néon","Vaso de neón"],
  ["Window Ghost","Raamgeest","Fantôme à la fenêtre","Fantasma en la ventana"],
  ["White Sky","Witte hemel","Ciel blanc","Cielo blanco"],
  ["Sky Islands","Luchteilanden","Îles du ciel","Islas del cielo"],
  ["Rainy Night","Regennacht","Nuit de pluie","Noche de lluvia"],
  ["Night Studio","Nachtstudio","Studio de nuit","Estudio nocturno"],
  ["Blue Crowd","Blauw publiek","Foule bleue","Público azul"],
  ["Two Rooms","Twee kamers","Deux chambres","Dos habitaciones"],
  ["Red Flying Car","Rode vliegende auto","Voiture volante rouge","Coche volador rojo"],
  ["Smoke Heart","Rookhart","Cœur de fumée","Corazón de humo"],
  ["Sunset Table","Tafel bij zonsondergang","Table au couchant","Mesa al atardecer"],
  ["Heart Over the Sea","Hart boven zee","Cœur sur la mer","Corazón sobre el mar"],
  ["Pink Hood","Roze motorkap","Capot rose","Capó rosa"],
  ["Cloud Car","Wolkenauto","Voiture de nuage","Coche de nube"],
  ["Sunset Roof","Dak in de zon","Toit au couchant","Azotea al atardecer"],
  ["Cadet","Cadet","Cadet","Cadete"],
  ["Pilot","Piloot","Pilote","Piloto"],
  ["Captain","Kapitein","Capitaine","Capitán"],
  ["Commander","Commandant","Commandant","Comandante"],
  ["Admiral","Admiraal","Amiral","Almirante"],
  ["First Remix","Eerste remix","Premier remix","Primer remix"],
  ["Turntable","Draaitafel","Platine","Tocadiscos"],
  ["Remix Master","Remixmeester","Maître du remix","Maestro del remix"],
  ["No End in Sight","Geen eind in zicht","Sans fin en vue","Sin final a la vista"],
  ["Infinity","Oneindig","Infini","Infinito"],
  ["First Light","Eerste licht","Première lueur","Primera luz"],
  ["Three Suns","Drie zonnen","Trois soleils","Tres soles"],
  ["Full Week","Hele week","Semaine pleine","Semana entera"],
  ["Two Weeks","Twee weken","Deux semaines","Dos semanas"],
  ["Full Month","Hele maand","Mois plein","Mes entero"],
  ["Two Months","Twee maanden","Deux mois","Dos meses"],
  ["Hundred Suns","Honderd zonnen","Cent soleils","Cien soles"],
  ["Long Road","Lange weg","Long chemin","Largo camino"],
  ["Around the Sun","Rondje om de zon","Tour du soleil","Vuelta al sol"],
  ["Spark","Vonk","Étincelle","Chispa"],
  ["Ember","Gloed","Braise","Brasa"],
  ["Flame","Vlam","Flamme","Llama"],
  ["Blaze","Laaiend vuur","Brasier","Hoguera"],
  ["Wildfire","Bosbrand","Feu de forêt","Incendio"],
  ["Inferno","Inferno","Inferno","Infierno"],
  ["Solar Flare","Zonnevlam","Éruption solaire","Llamarada solar"],
  ["Eternal Flame","Eeuwige vlam","Flamme éternelle","Llama eterna"],
  ["Day Winner","Dagwinnaar","Vainqueur du jour","Ganador del día"],
  ["Hat-Trick","Hattrick","Triplé","Triplete"],
  ["Lucky Seven","Geluksnummer","Sept chanceux","Siete de la suerte"],
  ["Silver Cup","Zilveren beker","Coupe d'argent","Copa de plata"],
  ["Champion","Kampioen","Champion","Campeón"],
  ["Grand Champion","Grootkampioen","Grand champion","Gran campeón"],
  ["Hall of Fame","Eregalerij","Panthéon","Salón de la fama"],
  ["Bronze Podium","Bronzen podium","Podium de bronze","Podio de bronce"],
  ["Silver Podium","Zilveren podium","Podium d'argent","Podio de plata"],
  ["Gold Podium","Gouden podium","Podium d'or","Podio de oro"],
  ["Yours","Van jou","À toi","Tuyo"],
];

/* ---- text with numbers in it: [the English as a pattern, nl, fr, es]; $1 $2 are the numbers or names in it,
   and a function gets (match, tr) to translate a part inside ---- */
const lv = (n, nl, fr, es) => [nl, fr, es];      // (for reading only)
const P = [
  [/^Best (.+)$/, "Beste $1", "Meilleur $1", "Mejor $1"],
  [/^Level (\d+)$/, "Level $1", "Niveau $1", "Nivel $1"],
  [/^Level (\d+) · (\d+) parts$/, "Level $1 · $2 delen", "Niveau $1 · $2 parties", "Nivel $1 · $2 partes"],
  [/^Level (\d+) · Endless ∞$/, "Level $1 · Eindeloos ∞", "Niveau $1 · Infini ∞", "Nivel $1 · Infinito ∞"],
  [/^Level (\d+) · (.+)$/, "Level $1 · $2", "Niveau $1 · $2", "Nivel $1 · $2"],
  [/^Level (\d+) Part (\d) ∞$/, "Level $1 Deel $2 ∞", "Niveau $1 Partie $2 ∞", "Nivel $1 Parte $2 ∞"],
  [/^Level (\d+) Part (\d)$/, "Level $1 Deel $2", "Niveau $1 Partie $2", "Nivel $1 Parte $2"],
  [/^Level (\d+) ∞$/, "Level $1 ∞", "Niveau $1 ∞", "Nivel $1 ∞"],
  [/^Level (\d+) Remix$/, "Level $1 Remix", "Niveau $1 Remix", "Nivel $1 Remix"],
  [/^Part (\d)$/, "Deel $1", "Partie $1", "Parte $1"],
  [/^Part (\d) ∞$/, "Deel $1 ∞", "Partie $1 ∞", "Parte $1 ∞"],
  [/^Part (\d)\. (.+)$/, (m, tr) => ["Deel ", "Partie ", "Parte "][I] + m[1] + ". " + tr(m[2])],
  [/^Clear Level (\d+) Part (\d) to open$/, "Speel Level $1 Deel $2 uit om te openen", "Termine le niveau $1 partie $2 pour ouvrir", "Supera el nivel $1 parte $2 para abrir"],
  [/^Clear Level (\d+) to open$/, "Speel Level $1 uit om te openen", "Termine le niveau $1 pour ouvrir", "Supera el nivel $1 para abrir"],
  [/^Clear Part (\d) to open$/, "Speel Deel $1 uit om te openen", "Termine la partie $1 pour ouvrir", "Supera la parte $1 para abrir"],
  [/^Clear all (\d) parts to open$/, "Speel alle $1 delen uit om te openen", "Termine les $1 parties pour ouvrir", "Supera las $1 partes para abrir"],
  [/^Finish Level (\d+) first$/, "Speel eerst Level $1 uit", "Termine d'abord le niveau $1", "Termina primero el nivel $1"],
  [/^Finish Part (\d) first$/, "Speel eerst Deel $1 uit", "Termine d'abord la partie $1", "Termina primero la parte $1"],
  [/^Score ([\d,.]+) in (Part|Level) (\d+) to open$/, (m) => [["Scoor " + m[1] + " in " + (m[2] === "Part" ? "Deel " : "Level ") + m[3] + " om te openen"], ["Marque " + m[1] + (m[2] === "Part" ? " dans la partie " : " au niveau ") + m[3] + " pour ouvrir"], ["Consigue " + m[1] + (m[2] === "Part" ? " en la parte " : " en el nivel ") + m[3] + " para abrir"]][I][0]],
  [/^(.+?) (Be the first|Create a free account and be the first)\.$/, (m, tr) => tr(m[1]) + " " + (m[2] === "Be the first" ? ["Wees de eerste.", "Sois le premier.", "Sé el primero."] : ["Maak een gratis account en wees de eerste.", "Crée un compte gratuit et sois le premier.", "Crea una cuenta gratis y sé el primero."])[I]],
  [/^Endless: (.+)$/, (m, tr) => ["Eindeloos: ", "Infini : ", "Infinito: "][I] + tr(m[1])],
  [/^(.+) with no end - your best (.+)$/, "$1 zonder einde - je record $2", "$1 sans fin - ton record $2", "$1 sin fin - tu récord $2"],
  [/^(.+) with no end$/, "$1 zonder einde", "$1 sans fin", "$1 sin fin"],
  [/^(\d+) of (\d+) parts cleared$/, "$1 van $2 delen uitgespeeld", "$1 parties sur $2 terminées", "$1 de $2 partes superadas"],
  [/^(\d+) of (\d+) stars$/, (m) => m[1] + [" van " + m[2] + " sterren", (m[1] === "1" ? " étoile" : " étoiles") + " sur " + m[2], " de " + m[2] + " estrellas"][I]],
  [/^Next star at ([\d,.]+)$/, "Volgende ster bij $1", "Prochaine étoile à $1", "Siguiente estrella en $1"],
  [/^(\d+) of (\d+) cleared$/, "$1 van $2 uitgespeeld", "$1 sur $2 terminées", "$1 de $2 superadas"],
  [/^(\d+) of (\d+)$/, "$1 van $2", "$1 sur $2", "$1 de $2"],
  [/^([\d,.]+) points · creator, every level open$/, "$1 punten · maker, elk level open", "$1 points · créateur, tous les niveaux ouverts", "$1 puntos · creador, todos los niveles abiertos"],
  [/^\+?([\d,.]+) points?$/, (m) => (m[0][0] === "+" ? "+" : "") + m[1] + ["", " punten", " points", " puntos"][I + 1]],
  [/^([\d,.]+) pts$/, "$1 ptn", "$1 pts", "$1 pts"],
  [/^Continue · (.+)$/, (m, tr) => ["Verder · ", "Continuer · ", "Continuar · "][I] + tr(m[1])],
  [/^Start here · (.+)$/, (m, tr) => ["Begin hier · ", "Commence ici · ", "Empieza aquí · "][I] + tr(m[1])],
  [/^(.+), (\d+) points$/, "$1, $2 punten", "$1, $2 points", "$1, $2 puntos"],
  [/^Unlocked$/, "Ontgrendeld", "Débloqué", "Desbloqueado"],
  // "Level 3 Part 2 and Level 4 are open", with or without a full stop (a guest's message goes on: "Log in to save it")
  [/^([^·]+?) (is|are) open(\.?)$/, (m, tr) => m[1].split(" and ").map(x => tr(x)).join([" en ", " et ", " y "][I]) +
    (m[2] === "is" ? [" is open", " est ouvert", " está abierto"] : [" zijn open", " sont ouverts", " están abiertos"])[I] + m[3]],
  [/^(.+) opens when you finish this one\.$/, (m, tr) => tr(m[1]) + [" gaat open als je deze uitspeelt.", " s'ouvre quand tu termines celui-ci.", " se abre cuando termines este."][I]],
  [/^(.+) - (Clear|Finish|Score) (.+)\.$/, (m, tr) => tr(m[1]) + " - " + tr(m[2] + " " + m[3]) + "."],
  [/^Song (\d+) of (\d+) ✓$/, "Nummer $1 van $2 ✓", "Morceau $1 sur $2 ✓", "Canción $1 de $2 ✓"],
  [/^next: (.+)$/, (m, tr) => ["volgende: ", "suivant : ", "siguiente: "][I] + tr(m[1])],
  [/^(\d)(st|nd|rd|th) place\.$/, (m) => [m[1] + "e plaats.", m[1] + (m[1] === "1" ? "re" : "e") + " place.", m[1] + ".º puesto."][I]],
  [/^New best today[:!] (.+)$/, "Nieuw dagrecord! $1", "Nouveau record du jour ! $1", "¡Nuevo récord del día! $1"],
  [/^Today's best: $/, "Record van vandaag: ", "Record du jour : ", "Récord de hoy: "],
  [/^#(\d+)$/, "#$1", "#$1", "#$1"],
  [/^ on today's board$/, " op het bord van vandaag", " au classement du jour", " en la tabla de hoy"],
  [/^Golf · (\d)$/, "Golf · $1", "Golf · $1", "Golf · $1"],
  [/^Copied: $/, "Gekopieerd: ", "Copié : ", "Copiado: "]
];

/* ---- sentences with bold words or links in them, translated whole: [English html, nl, fr, es] ---- */
const HTML = [
  ['<small>The first online one</small>HOOPS <i>1v1</i>', '<small>De eerste online</small>HOOPS <i>1v1</i>', '<small>Le premier en ligne</small>HOOPS <i>1v1</i>', '<small>El primero online</small>HOOPS <i>1v1</i>'],
  ['<small>Memory, head to head</small>PASS IT ON <i>1v1</i>', '<small>Geheugen, man tegen man</small>PASS IT ON <i>1v1</i>', '<small>Mémoire, face à face</small>PASS IT ON <i>1v1</i>', '<small>Memoria, cara a cara</small>PASS IT ON <i>1v1</i>'],
  ['<small>Two card games</small>BLIND LOVE <i>1v1</i>', '<small>Twee kaartspellen</small>BLIND LOVE <i>1v1</i>', '<small>Deux jeux de cartes</small>BLIND LOVE <i>1v1</i>', '<small>Dos juegos de cartas</small>BLIND LOVE <i>1v1</i>'],
  ['<small>On the roofs at sunset</small>GO! <i>ONLINE</i>', '<small>Op de daken bij zonsondergang</small>GO! <i>ONLINE</i>', '<small>Sur les toits au coucher du soleil</small>GO! <i>EN LIGNE</i>', '<small>En los tejados al atardecer</small>GO! <i>ONLINE</i>'],
  ['Quick match against a real player. <b>Live:</b> the same song and the same shots at the same time, side by side - the highest score wins. <b>H-O-R-S-E:</b> take turns - make a shot and they have to make it too, or it\'s a letter. Spell HORSE and you\'re out. A win is +25 points.',
   'Snelle match tegen een echte speler. <b>Live:</b> hetzelfde nummer en dezelfde schoten tegelijk, naast elkaar - de hoogste score wint. <b>H-O-R-S-E:</b> om de beurt - maak een schot en de ander moet het ook maken, anders is het een letter. Spel je HORSE, dan lig je eruit. Winnen is +25 punten.',
   'Match rapide contre un vrai joueur. <b>Live :</b> le même morceau et les mêmes tirs en même temps, côte à côte - le meilleur score gagne. <b>H-O-R-S-E :</b> chacun son tour - réussis un tir et l\'autre doit le réussir aussi, sinon c\'est une lettre. HORSE en entier et tu es éliminé. Une victoire, c\'est +25 points.',
   'Partida rápida contra un jugador real. <b>Live:</b> la misma canción y los mismos tiros a la vez, uno al lado del otro - gana la puntuación más alta. <b>H-O-R-S-E:</b> por turnos - mete un tiro y el otro tiene que meterlo también, o es una letra. Si completas HORSE, quedas fuera. Ganar son +25 puntos.'],
  ['Quick match against a real player. <b>Love Cards:</b> one bed of cards between you - take turns turning two, a pair and you go again, the most pairs wins. <b>Snap:</b> the same cards for both at the same time - the quicker snap takes the pair. A win is +25 points.',
   'Snelle match tegen een echte speler. <b>Love Cards:</b> één bed vol kaarten tussen jullie - om de beurt twee omdraaien, een paar en je mag nog eens, de meeste paren wint. <b>Snap:</b> dezelfde kaarten voor allebei tegelijk - wie het snelst snapt, krijgt het paar. Winnen is +25 punten.',
   'Match rapide contre un vrai joueur. <b>Love Cards :</b> un lit de cartes entre vous - chacun retourne deux cartes à son tour, une paire et tu rejoues, le plus de paires gagne. <b>Snap :</b> les mêmes cartes pour les deux en même temps - le plus rapide prend la paire. Une victoire, c\'est +25 points.',
   'Partida rápida contra un jugador real. <b>Love Cards:</b> una cama de cartas entre los dos - por turnos dais la vuelta a dos, una pareja y repites, gana quien tenga más parejas. <b>Snap:</b> las mismas cartas para los dos a la vez - el SNAP más rápido se lleva la pareja. Ganar son +25 puntos.'],
  ['Quick match against real players. <b>Golf</b> for 2, 3 or 4: the same nine holes at the same time, the others as ghost balls - the fewest strokes takes the hole, the most holes wins. <b>Hockey:</b> one air hockey table, first to 3 rounds. A win is +25 points; with 3 or 4, 2nd place earns some too.',
   'Snelle match tegen echte spelers. <b>Golf</b> voor 2, 3 of 4: dezelfde negen holes tegelijk, de anderen als spookballen - de minste slagen wint de hole, de meeste holes wint. <b>Hockey:</b> één airhockeytafel, wie het eerst 3 rondes wint. Winnen is +25 punten; met 3 of 4 verdient de tweede plaats ook wat.',
   'Match rapide contre de vrais joueurs. <b>Golf</b> à 2, 3 ou 4 : les mêmes neuf trous en même temps, les autres en balles fantômes - le moins de coups gagne le trou, le plus de trous gagne. <b>Hockey :</b> une table de air hockey, le premier à 3 manches. Une victoire, c\'est +25 points ; à 3 ou 4, la 2e place rapporte aussi.',
   'Partida rápida contra jugadores reales. <b>Golf</b> para 2, 3 o 4: los mismos nueve hoyos a la vez, los demás como bolas fantasma - menos golpes gana el hoyo, más hoyos gana. <b>Hockey:</b> una mesa de hockey de aire, el primero en ganar 3 rondas. Ganar son +25 puntos; con 3 o 4, el 2.º puesto también gana algo.'],
  ["The same song for everyone today, with its own scoreboard - empty again tomorrow. You haven't got this far yet: <b>clear it and it stays open for you.</b>", "Vandaag hetzelfde nummer voor iedereen, met een eigen scorebord - morgen weer leeg. Zo ver ben je nog niet: <b>speel het uit en het blijft voor jou open.</b>", "Le même morceau pour tout le monde aujourd'hui, avec son propre classement - vide à nouveau demain. Tu n'es pas encore arrivé jusque-là : <b>termine-le et il reste ouvert pour toi.</b>", "La misma canción para todos hoy, con su propia clasificación - vacía otra vez mañana. Aún no has llegado hasta aquí: <b>supéralo y se queda abierto para ti.</b>"]
];
// the same, with a number in them: [English as a pattern on the html, a function giving the translation]
const HP = [
  // the online games' line under the start button (the dot, then the sentence, a player's name inside)
  [/^<span class="dot"><\/span>Found (.+) - (getting the court ready|getting the lights ready|dealing the cards|setting up the table|setting up the course)…$/,
   m => '<span class="dot"></span>' + [m[1] + " gevonden - " + { "getting the court ready":"het veld wordt klaargezet", "getting the lights ready":"de lichtjes worden klaargezet", "dealing the cards":"de kaarten worden gedeeld", "setting up the table":"de tafel wordt klaargezet", "setting up the course":"de baan wordt klaargezet" }[m[2]] + "…",
     m[1] + (m[1].includes(", ") ? " trouvés - " : " trouvé - ") + { "getting the court ready":"on prépare le terrain", "getting the lights ready":"on prépare les lumières", "dealing the cards":"on distribue les cartes", "setting up the table":"on prépare la table", "setting up the course":"on prépare le parcours" }[m[2]] + "…",
     m[1] + (m[1].includes(", ") ? " encontrados - " : " encontrado - ") + { "getting the court ready":"preparando la cancha", "getting the lights ready":"preparando las luces", "dealing the cards":"repartiendo las cartas", "setting up the table":"preparando la mesa", "setting up the course":"preparando el recorrido" }[m[2]] + "…"][I]],
  [/^<span class="dot"><\/span>Playing (.+) - starting in <b>(\d+)<\/b>$/,
   m => '<span class="dot"></span>' + ["Tegen " + m[1] + " - begint over <b>" + m[2] + "</b>", "Contre " + m[1] + " - début dans <b>" + m[2] + "</b>", "Contra " + m[1] + " - empieza en <b>" + m[2] + "</b>"][I]],
  [/^<span class="dot"><\/span>Playing as <b>(.+?)<\/b>\. <b>Private room:<\/b> you play the (friend who opens|friends who open) your link\.$/,
   m => { const one = m[2] === "friend who opens"; return '<span class="dot"></span>' + ["Je speelt als <b>" + m[1] + "</b>. <b>Privékamer:</b> je speelt tegen " + (one ? "de vriend die" : "de vrienden die") + " je link open" + (one ? "t" : "en") + ".",
     "Tu joues en tant que <b>" + m[1] + "</b>. <b>Salle privée :</b> tu joues contre " + (one ? "l'ami qui ouvre" : "les amis qui ouvrent") + " ton lien.",
     "Juegas como <b>" + m[1] + "</b>. <b>Sala privada:</b> juegas contra " + (one ? "el amigo que abra" : "los amigos que abran") + " tu enlace."][I]; }],
  [/^<span class="dot"><\/span>Playing as <b>(.+?)<\/b>\. Quick match finds you (?:a real player|(\d+) real players)\.$/,
   m => '<span class="dot"></span>' + ["Je speelt als <b>" + m[1] + "</b>. Snelle match zoekt " + (m[2] ? m[2] + " echte spelers" : "een echte speler") + " voor je.",
     "Tu joues en tant que <b>" + m[1] + "</b>. Le match rapide te trouve " + (m[2] ? m[2] + " vrais joueurs" : "un vrai joueur") + ".",
     "Juegas como <b>" + m[1] + "</b>. La partida rápida te encuentra " + (m[2] ? m[2] + " jugadores reales" : "un jugador real") + "."][I]],
  [/^<span class="dot"><\/span>Looking for (a player|players)… <b>(\d+)<\/b> here now\.$/,
   m => '<span class="dot"></span>' + ["Op zoek naar " + (m[1] === "players" ? "spelers" : "een speler") + "… nu <b>" + m[2] + "</b> hier.", "On cherche " + (m[1] === "players" ? "des joueurs" : "un joueur") + "… <b>" + m[2] + "</b> ici en ce moment.", "Buscando " + (m[1] === "players" ? "jugadores" : "un jugador") + "… <b>" + m[2] + "</b> aquí ahora."][I]],
  [/^<span class="dot"><\/span>Looking for players… <b>(\d+) of (\d+)<\/b> here( - waiting for your friends| - nobody else is looking right now)?\. Stay here - it starts when there are (\d+)\.$/,
   m => { const x = m[3] ? (m[3].includes("friends") ? [" - we wachten op je vrienden", " - on attend tes amis", " - esperando a tus amigos"] : [" - er zoekt nu verder niemand", " - personne d'autre ne cherche pour l'instant", " - nadie más está buscando ahora"])[I] : "";
     return '<span class="dot"></span>' + ["Op zoek naar spelers… <b>" + m[1] + " van de " + m[2] + "</b> hier" + x + ". Blijf hier - het begint als jullie met " + m[4] + " zijn.",
       "On cherche des joueurs… <b>" + m[1] + " sur " + m[2] + "</b> ici" + x + ". Reste ici - ça commence quand vous êtes " + m[4] + ".",
       "Buscando jugadores… <b>" + m[1] + " de " + m[2] + "</b> aquí" + x + ". Quédate aquí: empieza cuando seáis " + m[4] + "."][I]; }],
  [/^<span class="dot"><\/span>Waiting for (.+) to answer… keep JAVEDA open on both phones\.$/,
   m => '<span class="dot"></span>' + ["We wachten tot " + m[1] + " antwoordt… houd JAVEDA open op beide telefoons.", "On attend la réponse de " + m[1] + "… garde JAVEDA ouvert sur les deux téléphones.", "Esperando a que " + m[1] + " responda… mantén JAVEDA abierto en los dos móviles."][I]],
  [/^<span class="dot"><\/span><b>Log in<\/b> on the JAVEDA page to play online - the result goes on your account\.$/,
   () => '<span class="dot"></span>' + ["<b>Log in</b> op de JAVEDA-pagina om online te spelen - de uitslag komt op je account.", "<b>Connecte-toi</b> sur la page JAVEDA pour jouer en ligne - le résultat va sur ton compte.", "<b>Inicia sesión</b> en la página de JAVEDA para jugar online: el resultado va a tu cuenta."][I]],
  [/^You have <b>([\d,.]+) points<\/b>\. You earn them by playing: up to <b>40<\/b> a run for your score, <b>\+50<\/b> to <b>\+100<\/b> for every clear, <b>\+300<\/b> to <b>\+600<\/b> the first time you clear a part, <b>\+25<\/b> for an online win\. Endless and Remix pay only when you beat your best\. Buying a picture spends points but keeps your place on the Points board\.$/,
   m => ["Je hebt <b>" + m[1] + " punten</b>. Je verdient ze door te spelen: tot <b>40</b> per run voor je score, <b>+50</b> tot <b>+100</b> voor elke keer uitspelen, <b>+300</b> tot <b>+600</b> de eerste keer dat je een deel uitspeelt, <b>+25</b> voor een online zege. Eindeloos en Remix leveren alleen iets op als je je beste score verbetert. Een foto kopen kost punten, maar je houdt je plek op het puntenbord.",
         "Tu as <b>" + m[1] + " points</b>. Tu les gagnes en jouant : jusqu'à <b>40</b> par partie pour ton score, <b>+50</b> à <b>+100</b> pour chaque partie terminée, <b>+300</b> à <b>+600</b> la première fois que tu termines une partie, <b>+25</b> pour une victoire en ligne. Infini et Remix ne rapportent que si tu bats ton record. Acheter une image coûte des points, mais tu gardes ta place au classement des points.",
         "Tienes <b>" + m[1] + " puntos</b>. Los ganas jugando: hasta <b>40</b> por partida por tu puntuación, <b>+50</b> a <b>+100</b> por cada parte superada, <b>+300</b> a <b>+600</b> la primera vez que superas una parte, <b>+25</b> por una victoria online. Infinito y Remix solo dan puntos si superas tu mejor marca. Comprar una imagen cuesta puntos, pero conservas tu puesto en la tabla de puntos."][I]]
];
S.push(["JAVEDA by Lazy Jo ·", "JAVEDA door Lazy Jo ·", "JAVEDA par Lazy Jo ·", "JAVEDA de Lazy Jo ·"],
       ["Language", "Taal", "Langue", "Idioma"]);

// the levels' own words (i18n-levels.js, loaded before this file on the level pages)
const X = window.JAVEDA_I18N || {};
if (X.S) S.push(...X.S); if (X.P) P.unshift(...X.P); if (X.HTML) HTML.push(...X.HTML); if (X.HP) HP.push(...X.HP);

/* ---- the machinery ---- */
const EX = new Map(), TPL = new Map(); if (I != null) for (const r of S) (r[0].includes("#") ? TPL : EX).set(r[0], r[I + 1]);
const norm = s => s.replace(/\s+/g, " ").trim();
// a sentence with numbers in it, written once with # for each number: the numbers go back in, in order
const NUM = /\d+(?:[.,:]\d+)*/g;
const byTemplate = (k, map) => { if (!/\d/.test(k)) return null; const nums = k.match(NUM), t = map.get(k.replace(NUM, "#")); if (t == null) return null; let i = 0; return t.replace(/#/g, () => nums[i++] != null ? nums[i - 1] : "#"); };
// for the page's own code: a sentence in the language picked (the words that go with a shared link)
window.JAVEDA_T = t => (I == null ? t : tr(t) || t);
function tr(s){
  const k = norm(s); if (!k || I == null) return null;
  if (EX.has(k)) return EX.get(k);
  const bt = byTemplate(k, TPL); if (bt != null) return bt;
  for (const p of P){ const m = k.match(p[0]); if (!m) continue;
    const r = p[1]; if (typeof r === "function") return r(m, x => tr(x) || x);
    return k.replace(p[0], p[I + 1]); }
  // a message in parts: each part on its own
  if (k.includes(" · ")){ const parts = k.split(" · "), out = parts.map(x => tr(x)); if (out.some(x => x)) return parts.map((x, i) => out[i] || x).join(" · "); }
  // an emoji or a sign in front: the words after it
  const m = k.match(/^([^\p{L}\p{N}]+)\s*(.+)$/u); if (m && m[2] !== k){ const t = tr(m[2]); if (t) return m[1] + (m[1].endsWith(" ") ? "" : " ") + t; }
  return null;
}
const done = new WeakMap();      // a node -> the text we put there (so we don't translate our own words again)
const ATTRS = ["placeholder", "title", "aria-label"];
const INLINE = new Set(["B", "I", "STRONG", "EM", "A", "SMALL", "BR", "U", "CODE", "SPAN"]);
function doText(n){
  const v = n.nodeValue; if (!v || done.get(n) === v || !/[A-Za-z]{2}/.test(v)) return;
  const t = tr(v); if (t == null) return;
  const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0], out = lead + t + trail;
  done.set(n, out); if (out !== v) n.nodeValue = out;
}
function doAttrs(e){
  for (const a of ATTRS){ const v = e.getAttribute && e.getAttribute(a); if (!v || !/[A-Za-z]{2}/.test(v)) continue;
    const key = a + ":" + v; if (done.get(e) && done.get(e)[key]) continue;
    const t = tr(v); if (t != null && t !== v){ e.setAttribute(a, t); (done.get(e) || done.set(e, {}).get(e))[a + ":" + t] = 1; } }
}
// a sentence with bold words or links inside: the whole of it at once (H), else its pieces one by one
const H = new Map(), HT = new Map(); if (I != null) for (const r of HTML) (r[0].includes("#") ? HT : H).set(norm(r[0]), r[I + 1]);
// put a translated sentence into its element in place: the same bold words and links stay the same elements (a level
// may hold on to one, like a counter it updates), only their words change; if the shapes differ, the html goes in
function put(e, html){
  const t = document.createElement("template"); t.innerHTML = html;
  const a = [...e.childNodes], b = [...t.content.childNodes];
  const same = a.length === b.length && a.every((n, i) => n.nodeType === b[i].nodeType && (n.nodeType !== 1 || (n.tagName === b[i].tagName && [...n.childNodes].every(c => c.nodeType === 3))));
  if (!same){ e.innerHTML = html; return; }
  a.forEach((n, i) => { if (n.nodeType === 3) n.nodeValue = b[i].nodeValue; else if (n.nodeType === 1 && n.tagName !== "BR") n.textContent = b[i].textContent; });
}
function doBlock(e){
  const kids = e.childNodes; if (!kids.length) return false;
  let inl = false; for (const k of kids){ if (k.nodeType === 1){ if (!INLINE.has(k.tagName)) return false; inl = true; } }
  if (!inl) return false;
  const k = norm(e.innerHTML); if (done.get(e) === k) return true;
  for (const [re, f] of HP){ const m = k.match(re); if (m){ put(e, f(m)); done.set(e, norm(e.innerHTML)); return true; } }
  if (H.has(k)){ put(e, H.get(k)); done.set(e, norm(e.innerHTML)); return true; }
  const bt = byTemplate(k, HT); if (bt != null){ put(e, bt); done.set(e, norm(e.innerHTML)); return true; }
  return false;
}
function walk(root){
  if (I == null || !root) return;
  if (root.nodeType === 3){ if (root.parentElement && !root.parentElement.closest("script,style,[data-i18n-skip],#stats,#codes,.crt")) doText(root); return; }
  if (root.nodeType !== 1 || root.closest("script,style,[data-i18n-skip],#stats,#codes,.crt")) return;
  const els = [root, ...root.querySelectorAll("*")];
  const SKIP = "script,style,svg,[data-i18n-skip],#stats,#codes,.crt";
  for (const e of els){ if (e.closest(SKIP)) continue; doAttrs(e); }
  for (const e of els){ if (e.closest(SKIP)) continue; if (doBlock(e)) continue;
    for (const c of e.childNodes) if (c.nodeType === 3) doText(c); }
}

/* ---- the picker: EN NL FR ES, in the top bar ---- */
function picker(){
  // only on the JAVEDA page: a level follows the language picked there
  if (document.getElementById("langPick") || !document.getElementById("meBtn")) return;
  const top = document.querySelector(".top") || document.body;
  const st = document.createElement("style");
  st.textContent = "#langPick{display:flex;gap:2px;padding:3px;border:1px solid var(--line,#ffffff26);border-radius:999px;background:var(--panel,#0b1630);margin-left:auto;margin-right:8px}" +
    "#langPick button{border:0;background:none;border-radius:999px;padding:5px 8px;font:700 12px/1 var(--cond,'Arial Narrow',sans-serif);letter-spacing:.12em;color:var(--dim,#8fb4dd);cursor:pointer}" +
    "#langPick button[aria-pressed=\"true\"]{background:var(--blue,#2f8fe0);color:#041024}" +
    "@media (max-width:520px){#langPick button{padding:5px 6px;letter-spacing:.06em}}";
  document.head.appendChild(st);
  const p = document.createElement("div"); p.id = "langPick"; p.setAttribute("role", "group"); p.setAttribute("aria-label", "Language"); p.setAttribute("data-i18n-skip", "");
  p.innerHTML = LANGS.map(([k, t]) => '<button type="button" lang="' + k + '" data-lang="' + k + '" aria-pressed="' + (k === LANG) + '">' + t + '</button>').join("");
  p.addEventListener("click", ev => { const b = ev.target.closest("[data-lang]"); if (!b || b.dataset.lang === LANG) return;
    try { localStorage.setItem("javeda.lang", b.dataset.lang); } catch(e){} location.reload(); });
  const me = top.querySelector("#meBtn"); if (me) top.insertBefore(p, me); else top.appendChild(p);
}

function start(){
  picker();
  if (I == null) return;
  walk(document.body);
  if (document.title) { const t = tr(document.title); if (t) document.title = t; }
  new MutationObserver(list => { for (const m of list){
    if (m.type === "characterData"){ if (m.target.parentElement && !m.target.parentElement.closest("#stats,#codes,.crt,[data-i18n-skip]")) doText(m.target); }
    else if (m.type === "attributes") doAttrs(m.target);
    else { // new words put into a sentence (a level writing its message): the whole sentence first, else the new pieces
      const t = m.target; if (t.nodeType === 1 && !t.closest("script,style,svg,[data-i18n-skip],#stats,#codes,.crt") && doBlock(t)) continue;
      for (const n of m.addedNodes) walk(n); } } })
    .observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
