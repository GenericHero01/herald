<template>
  <form class="single-form" @submit.prevent="signup">
    <h1>SIGN UP</h1>

    <div class="form-group">
      <label for="field-email">Email</label>
      <input
        id="field-email"
        type="email"
        class="form-control"
        placeholder="Email Address"
        v-model="email"
        name="email"
        required="required"
        ref="email"
      />
    </div>

    <div class="form-group">
      <label for="field-password">Password</label>
      <input
        id="field-password"
        name="password"
        type="password"
        v-model="password"
        class="form-control required"
        placeholder="Password"
        required="required"
      />
    </div>

    <div class="form-subsection">
      <div class="groups">
        <div class="form-group">
          <label for="field-first_name">First Name</label>
          <input
            id="field-first_name"
            name="first_name"
            class="form-control"
            placeholder="First Name"
            v-model="first_name"
          />
        </div>

        <div class="form-group">
          <label for="field-last_name">Last Name</label>
          <input
            id="field-last_name"
            name="last_name"
            class="form-control"
            placeholder="Last Name"
            v-model="last_name"
          />
        </div>
      </div>
    </div>

    <!-- <div class="form-group">
      <label for="field-username">
        Username
        <span>(optional)</span>
      </label>
      <input
        id="field-username"
        name="username"
        class="form-control"
        placeholder="Username"
        v-model="username"
      />
    </div>-->

    <div class="form-group send-newsletter checkbox">
      <label>
        <input
          name="send_newsletter"
          class="form-control"
          type="checkbox"
          v-model="send_newsletter"
        />
        Receive infrequent (less than monthly) updates about new game features.
      </label>
    </div>

    <button class="btn-medium">SIGN UP</button>

    <p class="agree-tos-pos color-text-50">
      By signing up, you agree to our
      <a href="/#tos">Terms of Service</a> and
      <a href="/#privacy">Privacy Policy</a>.
    </p>
  </form>
</template>

<script lang='ts'>
import { Component, Prop, Vue } from "vue-property-decorator";
import { AUTH_ACTIONS } from "@/constants";

@Component
export default class SignUp extends Vue {
  @Prop() redirect!: string;

  email: string = "";
  password: string = "";
  send_newsletter: boolean = false;
  username: string = "";
  first_name: string = "";
  last_name: string = "";

  async signup() {
    const {
      email,
      password,
      send_newsletter,
      username,
      first_name,
      last_name
    } = this;
    try {
      const resp = await this.$store.dispatch("auth/signup", {
        email,
        password,
        send_newsletter,
        username,
        first_name,
        last_name
      });
      if (this.redirect) {
        this.$router.push({
          path: this.redirect,
          query: {
            create: "true"
          }
        });
      } else {
        this.$router.push({ name: "lobby" });
      }
    } catch (e) {
      // Stay on the page
    }
  }

  mounted() {
    const email = this.$refs.email as HTMLElement;
    email.focus();
  }
}
</script>

<style lang="scss" scoped>
@import "@/styles/layout.scss";
@import "@/styles/colors.scss";
@import "@/styles/fonts.scss";
.send-newsletter {
  color: $color-text-hex-50 !important;
}
</style>