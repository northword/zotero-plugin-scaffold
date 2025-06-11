import AdmZip from "adm-zip";

export default async function pack(dist: string, xpiName: string) {
  const zip = new AdmZip();
  zip.addLocalFolder(`${dist}/addon`);
  zip.writeZip(`${dist}/${xpiName}.xpi`);
}
