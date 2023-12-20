import e from "express";
import { Schema, model, Document } from "mongoose";

interface FAQItem extends Document {
  question: string;
  answer: string;
}

interface Category extends Document {
  title: string;
}

interface BannerImage extends Document {
  public_id: string;
  url: string;
}

interface Layout extends Document {
  type: string;
  faq: FAQItem[];
  categories: Category[];
  bannerImages: {
    image: BannerImage;
    title: string;
    subTitle: string;
  };
}

const faqSchema = new Schema<FAQItem>({
  question: {
    type: String,
  },
  answer: {
    type: String,
  },
});

const categorySchema = new Schema<Category>({
  title: {
    type: String,
  },
});

const bannerImageSchema = new Schema<BannerImage>({
  public_id: {
    type: String,
  },
  url: {
    type: String,
  },
});

const layoutSchema = new Schema<Layout>({
  type: {
    type: String,
  },
  faq: [faqSchema],
  categories: [categorySchema],
  bannerImages: {
    image: bannerImageSchema,
    title: {
      type: String,
    },
    subTitle: {
      type: String,
    },
  },
});

const layoutModel = model<Layout>("Layout", layoutSchema);

export default layoutModel;
