import mongoose from 'mongoose';

async function main() {
    try {
        await mongoose.connect('mongodb://localhost:27017/conciApi');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.log(error);
    }
}

main();
