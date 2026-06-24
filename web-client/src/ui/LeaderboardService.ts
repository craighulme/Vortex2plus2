export type LeaderboardPlayer = {
  id: number;
  username?: string;
  [key: string]: unknown;
};

export type LeaderboardColumn = {
  key: string;
  label: string;
};

export type LeaderboardApi = {
  setMyId(id: number): void;
  setColumns(columns: LeaderboardColumn[]): void;
  setPlayers(players: LeaderboardPlayer[]): void;
  addPlayer(player: LeaderboardPlayer): void;
  removePlayer(id: number): void;
  updateStat(id: number, key: string, value: unknown): void;
  batchUpdateStat(updates: Array<{ id: number; key: string; value: unknown }>): void;
  setFriendStatuses(map: Record<string, string>): void;
  setFriendStatus(id: number, status: string): void;
  setFollowStatus(id: number, status: string): void;
  getPlayer(id: number): LeaderboardPlayer | null;
  getPlayers(): LeaderboardPlayer[];
  selectPlayer(id: number): void;
  closeFriendPanel(): void;
  show(): void;
  hide(): void;
};

const noopApi: LeaderboardApi = {
  setMyId: () => {},
  setColumns: () => {},
  setPlayers: () => {},
  addPlayer: () => {},
  removePlayer: () => {},
  updateStat: () => {},
  batchUpdateStat: () => {},
  setFriendStatuses: () => {},
  setFriendStatus: () => {},
  setFollowStatus: () => {},
  getPlayer: () => null,
  getPlayers: () => [],
  selectPlayer: () => {},
  closeFriendPanel: () => {},
  show: () => {},
  hide: () => {}
};

export class LeaderboardService {
  private delegate: LeaderboardApi | null = null;
  private adoptedAt = 0;

  adopt(api: LeaderboardApi): void {
    this.delegate = api;
    this.adoptedAt = performance.now();
  }

  api(): LeaderboardApi {
    return this.delegate ?? noopApi;
  }

  snapshot(): { adopted: boolean; adoptedAt: number; players: number } {
    return {
      adopted: !!this.delegate,
      adoptedAt: this.adoptedAt,
      players: this.delegate?.getPlayers().length ?? 0
    };
  }
}
