import { Vue } from "vue-property-decorator";
import {
  BUILDER_ACTIONS_NAMESPACED as BUILDER_ACTIONS,
  BUILDER_MUTATIONS_NAMESPACED as BUILDER_MUTATIONS,
  DIRECTIONS,
  REVERSE_DIRECTIONS
} from "@/constants";
import axios from "axios";
import { Room } from "@/core/interfaces";
import router, {
  BUILDER_ZONE_PATH_DETAILS,
  BUILDER_MOB_TEMPLATE_DETAILS,
  BUILDER_MOB_TEMPLATE_LIST,
  BUILDER_ITEM_TEMPLATE_DETAILS,
  BUILDER_ITEM_TEMPLATE_LIST,
  BUILDER_ZONE_QUEST_DETAIL,
  BUILDER_ZONE_QUEST_LIST,
  BUILDER_ZONE_INDEX,
  BUILDER_ZONE_LOADER_DETAILS,
  BUILDER_ROOM_INDEX
} from "@/router";
import { get_room_index_key } from "@/core/map.ts";

import builder_rooms from "@/store/modules/builder/rooms/index.ts";
import builder_world from "@/store/modules/builder/worlds/index.ts";
import builder_zones from "@/store/modules/builder/zones/index.ts";

import root_store from "@/store";
import { makeState as makeCrud } from "@/store/crud.ts";

interface BuilderState {
  world_fetching: boolean;
  world?: any;
  rooms?: Room[];
  room?: Room | null;
  map?: any;
  showing?: "world" | "zone" | "room" | "mob_templates" | "item_templates";
  //mob_template?: any;
  //item_template?: any;
  zone?: any;
  zone_rooms?: Room[];
  map_index?: any;
  loader: any;
  path: any;
  quest: any;
}

const initial_state = (): BuilderState => {
  return {
    world_fetching: false,
    world: null,
    zone: null,
    zone_rooms: [],
    room: null,
    // mob_template: null,
    // item_template: null,
    rooms: [],
    map: null,
    map_index: null,
    loader: null,
    path: null,
    quest: null,
    showing: "world"
  };
};

const getters = {
  getNeighbors: state => room => {
    /*
      Return rooms that are 1 space away, and could therefore be connected to.
    */
    let neighbors = {};
    for (const direction in DIRECTIONS) {
      let x = room.x,
        y = room.y,
        z = room.z;

      if (direction == DIRECTIONS.north) y += 1;
      else if (direction == DIRECTIONS.east) x += 1;
      else if (direction == DIRECTIONS.south) y -= 1;
      else if (direction == DIRECTIONS.west) x -= 1;
      else if (direction == DIRECTIONS.up) z += 1;
      else if (direction == DIRECTIONS.down) z -= 1;

      let index_key = get_room_index_key(x, y, z);
      const neighbor_room = state.map_index[index_key];
      if (neighbor_room) {
        neighbors[direction] = neighbor_room;
      } else {
        neighbors[direction] = null;
      }
    }
    return neighbors;
  },

  getDirectionActions: (state, getters) => (room, direction) => {
    let exitRoom: Room | null = null;
    if (room[direction]) {
      exitRoom = state.map[room[direction].key];
    }

    let canCreate = false,
      canConnect = false,
      canDisconnect = false,
      canOneWay = false,
      reverse_direction = REVERSE_DIRECTIONS[direction];

    const neighborRoom = getters.getNeighbors(room)[direction];

    if (neighborRoom && exitRoom) {
      canDisconnect = true;
      if (neighborRoom.id == exitRoom.id) {
        const reverseExitAttrs = exitRoom[reverse_direction];
        if (reverseExitAttrs && reverseExitAttrs.id === room.id) {
          canOneWay = true;
        }
      } //else {
      //   canConnect = true;
      // }
    } else if (exitRoom) {
      canDisconnect = true;
      const reverseExitAttrs = exitRoom[reverse_direction];
      if (reverseExitAttrs && reverseExitAttrs.id === room.id) {
        canOneWay = true;
      }
    } else if (neighborRoom && !exitRoom) {
      canConnect = true;
      canOneWay = true;
    } else if (!neighborRoom) {
      canCreate = true;
    }

    return {
      canCreate,
      canConnect,
      canDisconnect,
      canOneWay
    };
  },

  coreFactionsOptions: state => {
    // Faction data as usable by create / edit mob pages.
    const factions: {}[] = [
      {
        value: "",
        label: ""
      }
    ];
    for (const faction of state.world.factions) {
      if (faction.is_core) {
        factions.push({
          value: faction.code,
          label: faction.name
        });
      }
    }
    return factions;
  },

  defaultCoreFaction: state => {
    const core_factions: any[] = [];
    for (const faction of state.world.factions) {
      if (faction.is_core && faction.is_default) {
        return faction.code;
      } else {
        core_factions.push(faction);
      }
    }
    return core_factions[0].code;
  }
};

const actions = {
  fetch_world: async ({ commit }, world_id) => {
    const resp = await axios.get(`/builder/worlds/${world_id}/`);
    const world_data = resp.data;
    commit("world_set", world_data);
    return world_data;
  },

  fetch_world_map: async ({ commit }, world_id) => {
    const resp = await axios.get(`/builder/worlds/${world_id}/map/`);
    commit("map_set", resp.data.rooms);
  },

  world_create: async ({ commit }, { name }) => {
    const resp = await axios.post(`/builder/worlds/`, { name });
    commit("world_set", resp.data);
    return resp.data;
  },

  world_save: async ({ commit, state }, data) => {
    const resp = await axios.put(`/builder/worlds/${state.world.id}/`, data);
    commit("world_set", resp.data);
    return resp.data;
  },

  world_delete: async ({ commit, state }) => {
    const resp = await axios.delete(`/builder/worlds/${state.world.id}/`);
    commit("world_clear");
  },

  // Assumes that a world is in the store
  zone_fetch: async ({ commit, dispatch }, { world_id, zone_id }) => {
    const endpoint = `/builder/worlds/${world_id}/zones/${zone_id}/`;
    const resp = await axios.get(endpoint);
    const zone = resp.data;
    commit("zone_set", zone);
    return zone;
  },

  zone_rooms_fetch: async ({ commit }, { world_id, zone_id }) => {
    const resp = await axios.get(
      `builder/worlds/${world_id}/zones/${zone_id}/map/`
    );
    const rooms = resp.data.rooms;
    commit("zone_rooms_set", rooms);
    commit("map_add", rooms);
    return rooms;
  },

  zone_create: async ({ commit, state }, payload) => {
    const world_id = state.world.id;
    const resp = await axios.post(`builder/worlds/${world_id}/zones/`, payload);
    commit("zone_set", resp.data);
    router.push({
      name: BUILDER_ZONE_INDEX,
      params: {
        world_id: world_id,
        zone_id: resp.data.id
      }
    });
  },

  zone_delete: async ({ commit, state }) => {
    const resp = await axios.delete(
      `builder/worlds/${state.world.id}/zones/${state.zone.id}/`
    );
    commit("zone_clear");
  },

  zone_save: async ({ commit, state }, payload) => {
    const resp = await axios.put(
      `builder/worlds/${state.world.id}/zones/${state.zone.id}/`,
      payload
    );
    commit("zone_set", resp.data);
  },

  room_action: async ({ state, commit }, payload) => {
    const resp = await axios.post(
      `builder/worlds/${state.world.id}/rooms/${state.room.key}/action/`,
      payload
    );
    // Save room changes
    const room = resp.data["room"];
    commit("room_set", room);
    // Update map
    const rooms = [room];
    if (resp.data["exit"]) rooms.push(resp.data["exit"]);
    commit("map_add", rooms);
    return resp.data;
  },

  room_select: async ({ commit, dispatch, state }, room) => {
    // Update store
    commit("room_set", room);

    // Dispatch fetch
    dispatch("room_fetch", {
      world_id: state.world.id,
      room_id: room.id
    });

    // If the clicked room is taking us to a new zone,
    // dispatch to get that as well
    if (room.zone.id != state.zone.id) {
      // Clear the zone's rooms since they will be refetched
      commit("zone_rooms_clear");
      dispatch("zone_fetch", {
        world_id: state.world.id,
        zone_id: room.zone.id
      });
    }
  },

  room_fetch: async ({ commit, state }, { world_id, room_id }) => {
    const resp = await axios.get(
      `/builder/worlds/${world_id}/rooms/${room_id}/`
    );
    const room_data = resp.data;
    delete room_data["map"];
    commit("room_set", room_data);
    return room_data;
  },

  room_save: async ({ state, commit, dispatch }, payload) => {
    const old_room = { ...state.room };
    const resp = await axios.put(
      `/builder/worlds/${state.world.id}/rooms/${state.room.id}/`,
      payload
    );
    const new_room = resp.data;
    commit("room_set", new_room);
    commit("map_deindex", [old_room]);
    commit("map_add", [new_room]);
    if (new_room.zone.id != state.zone.id) {
      dispatch("zone_fetch", {
        world_id: state.world.id,
        zone_id: new_room.zone.id
      });
    }
    return new_room;
  },

  room_delete: async ({ state, commit, getters }) => {
    await axios.delete(
      `builder/worlds/${state.world.id}/rooms/${state.room.id}/`
    );

    // Before deleting, identify a suitable other room to send the
    // user to afterwards.
    let nextRoom;
    for (const direction in DIRECTIONS) {
      if (state.room[direction]) {
        nextRoom = state.map[state.room[direction].key];
        break;
      }
    }
    // If we found no connection, try a neighbor
    if (!nextRoom) {
      const neighbors = getters.getNeighbors(state.room);
      for (const direction in DIRECTIONS) {
        if (neighbors[direction]) {
          nextRoom = state.map[neighbors[direction].key];
          break;
        }
      }
    }
    // Last resort, use starting room
    if (!nextRoom) {
      nextRoom = state.map[state.world.starting_room.key];
    }

    // Make sure all rooms that were connected to this room
    // get that direction nulled out
    const rooms_to_update: {}[] = [];
    for (const direction in DIRECTIONS) {
      if (state.room[direction]) {
        const exitRoom = {
          ...state.map[state.room[direction].key],
          [REVERSE_DIRECTIONS[direction]]: null
        };
        rooms_to_update.push(exitRoom);
      }
    }
    if (rooms_to_update.length) {
      commit("map_add", rooms_to_update);
    }

    commit("map_deindex", [state.room]);
    commit("map_remove", [state.room]);
    commit("room_clear");
    commit("room_set", nextRoom);
    // Redirect to the nextRoom
    router.push({
      name: BUILDER_ROOM_INDEX,
      params: {
        world_id: state.world.id,
        room_id: nextRoom.id
      }
    });
  },

  room_mark_last_viewed: async ({}, { world_id, room_id }) => {
    await axios.post(`/builder/worlds/${world_id}/rooms/${room_id}/`);
  },

  path_fetch: async ({ commit }, { world_id, path_id }) => {
    const resp = await axios.get(
      `builder/worlds/${world_id}/paths/${path_id}/`
    );
    commit("path_set", resp.data);
    return resp.data;
  },

  path_save: async ({ commit, state }, payload) => {
    const resp = await axios.put(
      `builder/worlds/${state.world.id}/paths/${state.path.id}/`,
      payload
    );
    commit("path_set", resp.data);
  },

  path_create: async ({ commit, state }, payload) => {
    const resp = await axios.post(
      `builder/worlds/${state.world.id}/zones/${state.zone.id}/paths/`,
      payload
    );
    commit("path_set", resp.data);
    router.push({
      name: BUILDER_ZONE_PATH_DETAILS,
      params: {
        world_id: state.world.id,
        path_id: resp.data.id
      }
    });
  }
};

const mutations = {
  register_collection: (state, { name, endpoint }) => {
    root_store.registerModule(["builder", name], makeCrud(endpoint));
  },

  unregister_collection: (store, name) => {
    root_store.unregisterModule(["builder", name]);
  },

  reset_state: state => {
    const s = initial_state();
    Object.keys(s).forEach(key => {
      state[key] = s[key];
    });
  },

  world_set: (state, world) => {
    state.world = world;
  },

  world_clear: (state, world) => {
    state.world = null;
  },

  room_set: (state, room) => {
    state.room = room;
  },

  room_clear: (state, room) => {
    state.room = null;
  },

  zone_set: (state, zone) => {
    state.zone = zone;
  },

  zone_rooms_set: (state, zone_rooms) => {
    state.zone_rooms = zone_rooms;
  },

  zone_rooms_clear: state => {
    state.zone_rooms = [];
  },

  map_set: (state, map) => {
    state.map = map;
    if (!state.map_index) state.map_index = {};

    const t3 = new Date().getTime();
    const map_index = {};
    for (const room_key in map) {
      const room = map[room_key];
      const index_pack = `${room.x}:${room.y}:${room.z}`;
      map_index[index_pack] = room;
    }

    state.map_index = map_index;
  },

  map_add: (state, rooms: Room[]) => {
    if (!state.map) state.map = {};
    if (!state.map_index) state.map_index = {};

    let newMap = {};
    let newIndex = {};
    for (const room of rooms) {
      newMap[room.key] = room;
      const index_pack = `${room.x}:${room.y}:${room.z}`;
      newIndex[index_pack] = room;
    }

    state.map = { ...state.map, ...newMap };
    state.map_index = { ...state.map_index, ...newIndex };
  },

  map_remove: (state, rooms: Room[]) => {
    for (const room of rooms) {
      delete state.map[room.key];
      const index_pack = `${room.x}:${room.y}:${room.z}`;
      delete state.map_index[index_pack];
    }
  },

  map_deindex: (state, rooms: Room[]) => {
    for (const room of rooms) {
      const index_pack = `${room.x}:${room.y}:${room.z}`;
      delete state.map_index[index_pack];
    }
  },

  map_alter_room: (state, room) => {
    state.map[room.key] = room;
    // TODO: if x, y or z change, reindex
  },

  path_set: (state, path) => {
    state.path = path;
  },

  path_rooms_add: (state, room) => {
    state.path.rooms.push(room);
  },

  path_rooms_delete: (state, room) => {
    const index = state.path.rooms.findIndex(_room => room.key == _room.key);
    if (index === -1) return;
    state.path.rooms.splice(index, 1);
  }
};

export default {
  namespaced: true,
  state: initial_state(),
  getters,
  actions,
  mutations,
  modules: {
    rooms: builder_rooms,
    worlds: builder_world,
    zones: builder_zones
  }
};
