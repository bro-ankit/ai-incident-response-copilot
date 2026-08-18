export class AdvisoryLockKeyUtil {
  static fromName(name: string): [namespace: number, id: number] {
    return [this.hash32(`${name}:namespace`), this.hash32(`${name}:id`)];
  }

  private static hash32(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
