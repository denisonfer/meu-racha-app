import { describe, expect, test } from "bun:test";
import {
  canLeaveRacha,
  memberPermissions,
  TMemberRole,
} from "./member-permissions";

const ROLES: TMemberRole[] = ["OWNER", "ADMIN", "PLAYER"];

describe("memberPermissions", () => {
  test("Jogador não abre ninguém", () => {
    for (const target of ROLES)
      for (const isSelf of [true, false])
        for (const isGoalkeeper of [true, false])
          expect(
            memberPermissions("PLAYER", target, isSelf, isGoalkeeper).canOpen
          ).toBe(false);
  });

  test("Dono edita tudo de um Jogador de linha", () => {
    expect(memberPermissions("OWNER", "PLAYER", false, false)).toEqual({
      canOpen: true,
      canEditStars: true,
      canChangeRole: true,
      canExpel: true,
      canTransferOwnership: true,
    });
  });

  test("Dono na própria linha: só as Estrelas", () => {
    expect(memberPermissions("OWNER", "OWNER", true, false)).toEqual({
      canOpen: true,
      canEditStars: true,
      canChangeRole: false,
      canExpel: false,
      canTransferOwnership: false,
    });
  });

  test("Dono Goleiro na própria linha não tem o que editar", () => {
    expect(memberPermissions("OWNER", "OWNER", true, true).canOpen).toBe(false);
  });

  test("Dono diante de um Goleiro: Cargo e Expulsar, sem Estrelas", () => {
    expect(memberPermissions("OWNER", "PLAYER", false, true)).toEqual({
      canOpen: true,
      canEditStars: false,
      canChangeRole: true,
      canExpel: true,
      canTransferOwnership: true,
    });
  });

  test("Admin diante de um Jogador: Estrelas e Expulsar, sem Cargo", () => {
    expect(memberPermissions("ADMIN", "PLAYER", false, false)).toEqual({
      canOpen: true,
      canEditStars: true,
      canChangeRole: false,
      canExpel: true,
      canTransferOwnership: false,
    });
  });

  test("Admin diante de outro Admin: só as Estrelas", () => {
    expect(memberPermissions("ADMIN", "ADMIN", false, false)).toEqual({
      canOpen: true,
      canEditStars: true,
      canChangeRole: false,
      canExpel: false,
      canTransferOwnership: false,
    });
  });

  test("Admin diante do Dono: só as Estrelas", () => {
    expect(memberPermissions("ADMIN", "OWNER", false, false)).toEqual({
      canOpen: true,
      canEditStars: true,
      canChangeRole: false,
      canExpel: false,
      canTransferOwnership: false,
    });
  });

  test("Admin diante de outro Admin Goleiro não tem o que editar", () => {
    expect(memberPermissions("ADMIN", "ADMIN", false, true).canOpen).toBe(
      false
    );
  });

  test("Admin não abre a própria linha", () => {
    expect(memberPermissions("ADMIN", "ADMIN", true, false).canOpen).toBe(
      false
    );
  });

  test("ninguém expulsa o Dono nem a si", () => {
    for (const viewer of ROLES) {
      expect(memberPermissions(viewer, "OWNER", false, false).canExpel).toBe(
        false
      );
      expect(memberPermissions(viewer, viewer, true, false).canExpel).toBe(
        false
      );
    }
  });

  test("só o Dono passa o racha, e nunca para si", () => {
    expect(
      memberPermissions("OWNER", "PLAYER", false, false).canTransferOwnership
    ).toBe(true);
    expect(
      memberPermissions("OWNER", "ADMIN", false, true).canTransferOwnership
    ).toBe(true);
    expect(
      memberPermissions("OWNER", "OWNER", true, false).canTransferOwnership
    ).toBe(false);
    expect(
      memberPermissions("ADMIN", "PLAYER", false, false).canTransferOwnership
    ).toBe(false);
    expect(
      memberPermissions("PLAYER", "PLAYER", false, false).canTransferOwnership
    ).toBe(false);
  });
});

describe("canLeaveRacha", () => {
  test("só o Dono não sai", () => {
    expect(canLeaveRacha("OWNER")).toBe(false);
    expect(canLeaveRacha("ADMIN")).toBe(true);
    expect(canLeaveRacha("PLAYER")).toBe(true);
  });
});
