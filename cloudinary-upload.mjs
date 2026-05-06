import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: 'dr2fjkaye',
  api_key: '779558513618122',
  api_secret: 'WGqVdpXbgoiwIoBoTQbS5v_Y1xM'
});

const videos = [
  { local: 'public/assets/img/login.mp4', public_id: 'login' }
];

async function uploadVideo(video) {
  const filePath = path.resolve(video.local);
  
  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️ Le fichier ${video.local} n'existe pas ou a déjà été traité.`);
    return;
  }

  console.log(`⏳ Téléchargement de ${video.local} (50 Mo) vers Cloudinary...`);
  
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      public_id: video.public_id,
      overwrite: true
    });
    
    console.log(`✅ Succès : ${video.local} est en ligne !`);
    console.log(`🔗 URL : ${result.secure_url}`);
    
    // Suppression locale après succès pour éviter le push GitHub
    fs.unlinkSync(filePath);
    console.log(`🗑️ Fichier local supprimé : ${video.local}`);
  } catch (error) {
    console.error(`❌ Erreur lors du téléchargement de ${video.local}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Migration de la nouvelle vidéo login.mp4...');
  for (const video of videos) {
    await uploadVideo(video);
  }
  console.log('🏁 Terminé.');
}

main();
