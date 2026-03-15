import Array "mo:core/Array";
import Order "mo:core/Order";
import Iter "mo:core/Iter";

actor {
  type ScoreEntry = {
    playerName : Text;
    score : Nat;
  };

  module ScoreEntry {
    public func compare(entry1 : ScoreEntry, entry2 : ScoreEntry) : Order.Order {
      Nat.compare(entry2.score, entry1.score);
    };
  };

  var scores : [ScoreEntry] = [];

  public shared ({ caller }) func submitScore(playerName : Text, score : Nat) : async () {
    let newEntry : ScoreEntry = {
      playerName;
      score;
    };
    scores := scores.concat([newEntry]);
  };

  public query ({ caller }) func getTopScores() : async [ScoreEntry] {
    let sorted = scores.sort();
    let length = if (sorted.size() < 10) { sorted.size() } else { 10 };
    Array.tabulate<ScoreEntry>(length, func(i) { sorted[i] });
  };
};
